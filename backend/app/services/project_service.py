"""Project service - business logic for project management."""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.task import Task
from app.models.finding import Finding


class ProjectService:
    """Service for project-related business logic."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, project_id: UUID) -> Project | None:
        result = await self.db.execute(select(Project).where(Project.id == project_id))
        return result.scalar_one_or_none()

    async def list_by_owner(
        self,
        owner_id: UUID,
        page: int = 1,
        page_size: int = 20,
        status: Optional[str] = None,
        search: Optional[str] = None,
    ) -> tuple[list[Project], int]:
        query = select(Project).where(Project.owner_id == owner_id)
        if status:
            query = query.where(Project.status == status)
        if search:
            query = query.where(Project.name.ilike(f"%{search}%"))

        count = (await self.db.execute(
            select(func.count()).select_from(query.subquery())
        )).scalar() or 0

        query = query.order_by(Project.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)
        return list(result.scalars().all()), count

    async def create_project(
        self,
        name: str,
        owner_id: UUID,
        description: Optional[str] = None,
        scope: Optional[dict] = None,
        tags: Optional[list[str]] = None,
        settings: Optional[dict] = None,
    ) -> Project:
        project = Project(
            name=name,
            description=description,
            scope=scope,
            tags=tags,
            settings=settings or {},
            owner_id=owner_id,
        )
        self.db.add(project)
        await self.db.flush()
        await self.db.refresh(project)
        return project

    async def get_project_stats(self, project_id: UUID) -> dict:
        """Get aggregated stats for a project."""
        total_tasks = (await self.db.execute(
            select(func.count(Task.id)).where(Task.project_id == project_id)
        )).scalar() or 0

        completed_tasks = (await self.db.execute(
            select(func.count(Task.id)).where(
                Task.project_id == project_id, Task.status == "completed"
            )
        )).scalar() or 0

        failed_tasks = (await self.db.execute(
            select(func.count(Task.id)).where(
                Task.project_id == project_id, Task.status == "failed"
            )
        )).scalar() or 0

        # Findings through tasks
        finding_sub = (
            select(Finding)
            .join(Task, Finding.task_id == Task.id)
            .where(Task.project_id == project_id)
        ).subquery()

        total_findings = (await self.db.execute(
            select(func.count()).select_from(finding_sub)
        )).scalar() or 0

        severities = {}
        for sev in ["critical", "high", "medium", "low", "info"]:
            severities[sev] = (await self.db.execute(
                select(func.count()).select_from(finding_sub).where(
                    finding_sub.c.severity == sev
                )
            )).scalar() or 0

        return {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "failed_tasks": failed_tasks,
            "total_findings": total_findings,
            **{f"{k}_findings": v for k, v in severities.items()},
        }
