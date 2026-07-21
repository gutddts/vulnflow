"""Celery tasks for individual skill execution in Docker."""

from __future__ import annotations

import json
from uuid import UUID

from sqlalchemy import select

from app.config import get_settings
from app.core.database import async_session_factory
from app.core.logging import logger
from app.models.skill import Skill
from app.services.skill_executor import DockerSkillService
from app.tasks.celery_app import celery_app

settings = get_settings()


@celery_app.task(bind=True, max_retries=2)
def execute_skill_task(
    self,
    skill_id: str,
    task_id: str,
    parameters: str = "{}",
) -> dict:
    """Execute a single skill in a Docker container."""
    import asyncio

    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(
            _execute_skill_async(skill_id, task_id, parameters)
        )
        return result
    except Exception as exc:
        logger.error("celery_skill_error", skill_id=skill_id, task_id=task_id, error=str(exc))
        raise self.retry(exc=exc, countdown=30)
    finally:
        loop.close()


async def _execute_skill_async(
    skill_id: str,
    task_id: str,
    parameters: str,
) -> dict:
    """Async skill execution logic."""
    async with async_session_factory() as db:
        result = await db.execute(select(Skill).where(Skill.id == UUID(skill_id)))
        skill = result.scalar_one_or_none()

        if skill is None:
            return {"success": False, "error": f"Skill {skill_id} not found"}

        if not skill.is_enabled:
            return {"success": False, "error": f"Skill {skill.name} is disabled"}

        params = json.loads(parameters) if parameters else {}
        env_vars = skill.environment_vars or {}

        executor = DockerSkillService()

        result_data = await executor.execute_skill(
            image=skill.image,
            entrypoint=skill.entrypoint,
            parameters=params,
            environment=env_vars,
            timeout=skill.timeout,
            max_memory_mb=skill.max_memory_mb,
            max_cpu=skill.max_cpu,
        )

        logger.info(
            "skill_executed",
            skill_name=skill.name,
            skill_id=skill_id,
            task_id=task_id,
            success=result_data.get("success"),
        )

        return result_data
