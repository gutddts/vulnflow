"""Celery tasks for cleanup and maintenance."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select, delete

from app.core.database import async_session_factory
from app.core.logging import logger
from app.models.task import Task, TaskStatus
from app.tasks.celery_app import celery_app


@celery_app.task(name="cleanup_expired_tasks")
def cleanup_expired_tasks() -> dict:
    """Clean up old completed/failed/cancelled tasks."""
    import asyncio

    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(_cleanup_expired_tasks_async())
        return result
    except Exception as exc:
        logger.error("cleanup_tasks_error", error=str(exc))
        return {"success": False, "error": str(exc)}
    finally:
        loop.close()


async def _cleanup_expired_tasks_async() -> dict:
    """Async cleanup of expired tasks."""
    async with async_session_factory() as db:
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)

        # Delete tasks that completed/failed/cancelled more than 30 days ago
        result = await db.execute(
            delete(Task).where(
                Task.status.in_([
                    TaskStatus.COMPLETED,
                    TaskStatus.FAILED,
                    TaskStatus.CANCELLED,
                ]),
                Task.completed_at < cutoff,
            )
        )
        deleted_count = result.rowcount
        await db.commit()

        logger.info("cleanup_completed", deleted_tasks=deleted_count)

        return {
            "success": True,
            "deleted_tasks": deleted_count,
        }


@celery_app.task(name="cleanup_orphaned_containers")
def cleanup_orphaned_containers() -> dict:
    """Clean up orphaned Docker containers from skill execution."""
    import asyncio

    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(_cleanup_orphaned_containers_async())
        return result
    except Exception as exc:
        logger.error("cleanup_containers_error", error=str(exc))
        return {"success": False, "error": str(exc)}
    finally:
        loop.close()


async def _cleanup_orphaned_containers_async() -> dict:
    """Async cleanup of orphaned Docker containers."""
    try:
        import docker
        from app.config import get_settings

        settings = get_settings()
        client = docker.DockerClient(base_url=settings.DOCKER_HOST)

        removed = 0
        for container in client.containers.list(all=True):
            # Clean up containers with vulnflow labels that are exited
            if container.status == "exited":
                labels = container.labels or {}
                if labels.get("app") == "vulnflow" or "vulnflow" in container.name:
                    try:
                        container.remove()
                        removed += 1
                    except Exception as exc:
                        logger.warning(
                            "container_remove_failed",
                            container_id=container.id[:12],
                            error=str(exc),
                        )

        logger.info("container_cleanup_completed", removed_count=removed)
        return {"success": True, "removed_containers": removed}

    except ImportError:
        logger.warning("docker_not_available_for_cleanup")
        return {"success": False, "error": "Docker SDK not available"}
    except Exception as exc:
        logger.error("container_cleanup_error", error=str(exc))
        return {"success": False, "error": str(exc)}


@celery_app.task(name="cleanup_stale_sessions")
def cleanup_stale_sessions() -> dict:
    """Clean up stale chat sessions and WebSocket connections."""
    import asyncio

    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(_cleanup_stale_sessions_async())
        return result
    except Exception as exc:
        logger.error("session_cleanup_error", error=str(exc))
        return {"success": False, "error": str(exc)}
    finally:
        loop.close()


async def _cleanup_stale_sessions_async() -> dict:
    """Async cleanup of stale chat sessions."""
    async with async_session_factory() as db:
        from app.models.chat_session import ChatSession

        cutoff = datetime.now(timezone.utc) - timedelta(days=90)

        result = await db.execute(
            delete(ChatSession).where(
                ChatSession.is_archived == True,
                ChatSession.updated_at < cutoff,
            )
        )
        deleted_count = result.rowcount
        await db.commit()

        logger.info("session_cleanup_completed", deleted_sessions=deleted_count)

        return {
            "success": True,
            "deleted_sessions": deleted_count,
        }
