"""Task service - business logic for task execution management."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task, TaskStatus


class TaskService:
    """Service for task-related business logic."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, task_id: uuid.UUID) -> Task | None:
        result = await self.db.execute(select(Task).where(Task.id == task_id))
        return result.scalar_one_or_none()

    async def list_tasks(
        self,
        project_id: Optional[uuid.UUID] = None,
        workflow_id: Optional[uuid.UUID] = None,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Task], int]:
        query = select(Task)
        if project_id:
            query = query.where(Task.project_id == project_id)
        if workflow_id:
            query = query.where(Task.workflow_id == workflow_id)
        if status:
            query = query.where(Task.status == status)

        count = (await self.db.execute(
            select(func.count()).select_from(query.subquery())
        )).scalar() or 0

        query = query.order_by(Task.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)
        return list(result.scalars().all()), count

    async def create_task(
        self,
        name: str,
        project_id: uuid.UUID,
        workflow_id: Optional[uuid.UUID] = None,
        parent_task_id: Optional[uuid.UUID] = None,
        priority: int = 0,
    ) -> Task:
        task = Task(
            name=name,
            project_id=project_id,
            workflow_id=workflow_id,
            parent_task_id=parent_task_id,
            priority=priority,
            status=TaskStatus.PENDING,
        )
        self.db.add(task)
        await self.db.flush()
        await self.db.refresh(task)
        return task

    async def update_task_status(self, task_id: uuid.UUID, status: str) -> Task | None:
        task = await self.get_by_id(task_id)
        if task is None:
            return None

        task.status = status
        if status == TaskStatus.RUNNING and task.started_at is None:
            task.started_at = datetime.now(timezone.utc)
        elif status in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED):
            task.completed_at = datetime.now(timezone.utc)
            if task.started_at:
                task.execution_time_ms = int(
                    (task.completed_at - task.started_at).total_seconds() * 1000
                )

        await self.db.flush()
        await self.db.refresh(task)
        return task

    async def append_log(
        self, task_id: uuid.UUID, level: str, message: str, data: Optional[dict] = None
    ) -> None:
        task = await self.get_by_id(task_id)
        if task is None:
            return

        logs = task.log or []
        logs.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": level,
            "message": message,
            "data": data,
        })
        task.log = logs
        await self.db.flush()

    async def update_progress(
        self, task_id: uuid.UUID, progress: float, current_node_id: Optional[str] = None
    ) -> None:
        await self.db.execute(
            update(Task)
            .where(Task.id == task_id)
            .values(progress=progress, current_node_id=current_node_id)
        )
        await self.db.flush()

    async def cancel_task(self, task_id: uuid.UUID) -> Task | None:
        task = await self.get_by_id(task_id)
        if task is None:
            return None
        if task.status not in (TaskStatus.PENDING, TaskStatus.QUEUED, TaskStatus.RUNNING):
            return None
        return await self.update_task_status(task_id, TaskStatus.CANCELLED)

    async def retry_task(self, task_id: uuid.UUID) -> Task | None:
        task = await self.get_by_id(task_id)
        if task is None:
            return None
        if task.status != TaskStatus.FAILED:
            return None

        task.status = TaskStatus.PENDING
        task.retry_count += 1
        task.error_message = None
        task.progress = 0.0
        task.started_at = None
        task.completed_at = None
        task.execution_time_ms = None
        await self.db.flush()
        await self.db.refresh(task)
        return task
