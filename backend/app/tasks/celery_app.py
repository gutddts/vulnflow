"""Celery application configuration."""

from __future__ import annotations

from celery import Celery

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "vulnflow",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.workflow_tasks",
        "app.tasks.skill_tasks",
        "app.tasks.scan_tasks",
        "app.tasks.report_tasks",
        "app.tasks.cleanup_tasks",
    ],
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
    task_soft_time_limit=3300,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=100,
    result_expires=86400,
    broker_connection_retry_on_startup=True,
)

# Task routing
celery_app.conf.task_routes = {
    "app.tasks.workflow_tasks.*": {"queue": "workflow"},
    "app.tasks.skill_tasks.*": {"queue": "skill"},
    "app.tasks.scan_tasks.*": {"queue": "scan"},
    "app.tasks.report_tasks.*": {"queue": "report"},
    "app.tasks.cleanup_tasks.*": {"queue": "cleanup"},
}

# Periodic beat schedule
celery_app.conf.beat_schedule = {
    "cleanup-expired-tasks": {
        "task": "app.tasks.cleanup_tasks.cleanup_expired_tasks",
        "schedule": 3600.0,  # Every hour
    },
    "cleanup-orphaned-containers": {
        "task": "app.tasks.cleanup_tasks.cleanup_orphaned_containers",
        "schedule": 1800.0,  # Every 30 minutes
    },
}
