"""Celery tasks for workflow execution."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import get_settings
from app.core.database import async_session_factory
from app.core.logging import logger
from app.models.skill import Skill
from app.models.task import Task, TaskStatus
from app.models.workflow import Workflow, WorkflowEdge, WorkflowNode
from app.tasks.celery_app import celery_app
from app.tasks.skill_tasks import execute_skill_task

settings = get_settings()


async def _get_db_session() -> AsyncSession:
    """Create a new async database session for task execution."""
    return async_session_factory()


async def _execute_workflow_async(task_id: str) -> None:
    """Async implementation of workflow execution."""
    db = await _get_db_session()

    try:
        # Load task
        result = await db.execute(select(Task).where(Task.id == UUID(task_id)))
        task = result.scalar_one_or_none()
        if task is None:
            logger.error("workflow_task_not_found", task_id=task_id)
            return

        if task.workflow_id is None:
            await _fail_task(db, task, "No workflow associated with this task")
            return

        # Load workflow with nodes and edges
        wf_result = await db.execute(select(Workflow).where(Workflow.id == task.workflow_id))
        workflow = wf_result.scalar_one_or_none()
        if workflow is None:
            await _fail_task(db, task, "Workflow not found")
            return

        # Update task status
        task.status = TaskStatus.RUNNING
        task.started_at = datetime.now(timezone.utc)
        await db.commit()

        # Build execution graph
        nodes = list(workflow.nodes)
        edges = list(workflow.edges)

        if not nodes:
            await _fail_task(db, task, "Workflow has no nodes")
            return

        # Build adjacency and in-degree for topological execution
        node_map: dict[UUID, WorkflowNode] = {n.id: n for n in nodes}
        in_degree: dict[UUID, int] = {n.id: 0 for n in nodes}
        adj: dict[UUID, list[UUID]] = {n.id: [] for n in nodes}

        for edge in edges:
            if edge.source_node_id in adj and edge.target_node_id in in_degree:
                adj[edge.source_node_id].append(edge.target_node_id)
                in_degree[edge.target_node_id] += 1

        # Find nodes with no dependencies (in-degree 0)
        ready: list[UUID] = [nid for nid, deg in in_degree.items() if deg == 0]

        if not ready:
            await _fail_task(db, task, "Workflow has circular dependencies")
            return

        total_nodes = len(nodes)
        completed_count = 0
        node_results: dict[str, dict] = {}

        while ready:
            current_node_id = ready.pop(0)
            node = node_map[current_node_id]
            task.current_node_id = str(node.id)
            task.progress = (completed_count / total_nodes) * 100.0
            await db.commit()

            # Load skill
            skill_result = await db.execute(select(Skill).where(Skill.id == node.skill_id))
            skill = skill_result.scalar_one_or_none()
            if skill is None:
                await _log_task(db, task, "error", f"Skill not found for node {node.id}")
                await _fail_task(db, task, f"Skill not found for node {node.label}")
                return

            # Execute skill (synchronously in the task worker)
            await _log_task(db, task, "info", f"Executing node: {node.label} (skill: {skill.name})")

            try:
                skill_result = execute_skill_task.delay(
                    skill_id=str(skill.id),
                    task_id=str(task.id),
                    parameters=json.dumps(node.config or {}),
                )
                skill_output = skill_result.get(timeout=node.timeout_seconds)

                node_results[str(node.id)] = {
                    "node_label": node.label,
                    "skill_name": skill.name,
                    "status": "completed",
                    "output": skill_output,
                }

                await _log_task(
                    db, task, "info", f"Node {node.label} completed successfully"
                )

            except Exception as exc:
                node_results[str(node.id)] = {
                    "node_label": node.label,
                    "skill_name": skill.name,
                    "status": "failed",
                    "error": str(exc),
                }

                if node.retry_count > 0:
                    await _log_task(
                        db, task, "warning",
                        f"Node {node.label} failed, retrying... ({node.retry_count} retries left)"
                    )
                    node.retry_count -= 1
                    ready.insert(0, current_node_id)
                    continue
                else:
                    await _log_task(db, task, "error", f"Node {node.label} failed: {exc}")
                    task.node_results = node_results
                    task.result = node_results
                    await _fail_task(db, task, str(exc))
                    return

            completed_count += 1

            # Add newly ready nodes (whose dependencies are satisfied)
            for neighbor in adj[current_node_id]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    ready.append(neighbor)

        # Workflow completed successfully
        task.status = TaskStatus.COMPLETED
        task.progress = 100.0
        task.result = node_results
        task.node_results = node_results
        task.completed_at = datetime.now(timezone.utc)
        if task.started_at:
            task.execution_time_ms = int(
                (task.completed_at - task.started_at).total_seconds() * 1000
            )
        await db.commit()

        await _log_task(db, task, "info", "Workflow completed successfully")

    except Exception as exc:
        logger.error("workflow_execution_error", task_id=task_id, error=str(exc))
        try:
            await db.rollback()
            result = await db.execute(select(Task).where(Task.id == UUID(task_id)))
            task = result.scalar_one_or_none()
            if task:
                await _fail_task(db, task, str(exc))
        except Exception:
            pass
    finally:
        await db.close()


async def _log_task(
    db: AsyncSession, task: Task, level: str, message: str, data: dict | None = None
) -> None:
    """Append a log entry to the task."""
    logs = task.log or []
    logs.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "level": level,
        "node_id": task.current_node_id,
        "message": message,
        "data": data,
    })
    task.log = logs


async def _fail_task(db: AsyncSession, task: Task, error_message: str) -> None:
    """Mark a task as failed with an error message."""
    task.status = TaskStatus.FAILED
    task.error_message = error_message
    task.completed_at = datetime.now(timezone.utc)
    if task.started_at:
        task.execution_time_ms = int(
            (task.completed_at - task.started_at).total_seconds() * 1000
        )
    await _log_task(db, task, "error", f"Task failed: {error_message}")
    await db.commit()


# ------------------------------------------------------------------ #
#  Celery task entry point
# ------------------------------------------------------------------ #
@celery_app.task(bind=True, max_retries=3)
def execute_workflow_task(self, task_id: str) -> dict:
    """Celery task to execute a workflow."""
    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(_execute_workflow_async(task_id))
        return {"status": "completed", "task_id": task_id}
    except Exception as exc:
        logger.error("celery_workflow_error", task_id=task_id, error=str(exc))
        raise self.retry(exc=exc, countdown=60)
    finally:
        loop.close()
