"""Dashboard API endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.finding import Finding
from app.models.project import Project
from app.models.task import Task
from app.models.user import User
from app.schemas.dashboard import DashboardResponse, DashboardStats, RecentActivity

router = APIRouter()


@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get aggregated dashboard statistics."""
    # Project stats
    total_projects = (await db.execute(
        select(func.count(Project.id)).where(Project.owner_id == current_user.id)
    )).scalar() or 0
    active_projects = (await db.execute(
        select(func.count(Project.id)).where(
            Project.owner_id == current_user.id, Project.status == "active"
        )
    )).scalar() or 0

    # Task stats
    task_query = select(Task).join(Project).where(Project.owner_id == current_user.id)
    task_sub = task_query.subquery()

    total_tasks = (await db.execute(select(func.count()).select_from(task_sub))).scalar() or 0
    running_tasks = (await db.execute(
        select(func.count()).select_from(task_sub).where(task_sub.c.status == "running")
    )).scalar() or 0
    completed_tasks = (await db.execute(
        select(func.count()).select_from(task_sub).where(task_sub.c.status == "completed")
    )).scalar() or 0
    failed_tasks = (await db.execute(
        select(func.count()).select_from(task_sub).where(task_sub.c.status == "failed")
    )).scalar() or 0

    # Finding stats
    finding_query = select(Finding).join(Task).join(Project).where(
        Project.owner_id == current_user.id
    )
    finding_sub = finding_query.subquery()

    total_findings = (await db.execute(
        select(func.count()).select_from(finding_sub)
    )).scalar() or 0
    critical = (await db.execute(
        select(func.count()).select_from(finding_sub).where(finding_sub.c.severity == "critical")
    )).scalar() or 0
    high = (await db.execute(
        select(func.count()).select_from(finding_sub).where(finding_sub.c.severity == "high")
    )).scalar() or 0
    medium = (await db.execute(
        select(func.count()).select_from(finding_sub).where(finding_sub.c.severity == "medium")
    )).scalar() or 0
    low = (await db.execute(
        select(func.count()).select_from(finding_sub).where(finding_sub.c.severity == "low")
    )).scalar() or 0
    info = (await db.execute(
        select(func.count()).select_from(finding_sub).where(finding_sub.c.severity == "info")
    )).scalar() or 0

    # User stats (admin only in production)
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    total_agents = 0  # Placeholder for agent count

    stats = DashboardStats(
        total_projects=total_projects,
        active_projects=active_projects,
        total_tasks=total_tasks,
        running_tasks=running_tasks,
        completed_tasks=completed_tasks,
        failed_tasks=failed_tasks,
        total_findings=total_findings,
        critical_findings=critical,
        high_findings=high,
        medium_findings=medium,
        low_findings=low,
        info_findings=info,
        total_users=total_users,
        total_agents=total_agents,
    )

    # Task status distribution
    status_dist = {}
    for status_val in ["pending", "queued", "running", "paused", "completed", "failed", "cancelled"]:
        count = (await db.execute(
            select(func.count()).select_from(task_sub).where(task_sub.c.status == status_val)
        )).scalar() or 0
        status_dist[status_val] = count

    # Finding severity distribution
    severity_dist = {
        "critical": critical,
        "high": high,
        "medium": medium,
        "low": low,
        "info": info,
    }

    # Recent activities - get last 10 completed/failed tasks
    recent_result = await db.execute(
        select(Task)
        .join(Project)
        .where(Project.owner_id == current_user.id)
        .order_by(Task.updated_at.desc())
        .limit(10)
    )
    recent_tasks = recent_result.scalars().all()
    recent_activities = [
        RecentActivity(
            type="task_completed" if t.status == "completed" else "task_created",
            description=f"Task '{t.name}' {t.status}",
            timestamp=t.updated_at.isoformat() if t.updated_at else "",
            project_name=None,
            task_name=t.name,
        )
        for t in recent_tasks
    ]

    # Tasks over time (simplified - last 7 days)
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    tasks_over_time = []
    for i in range(7, -1, -1):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day.replace(hour=23, minute=59, second=59, microsecond=999999)
        count = (await db.execute(
            select(func.count()).select_from(task_sub).where(
                task_sub.c.created_at >= day_start,
                task_sub.c.created_at <= day_end,
            )
        )).scalar() or 0
        tasks_over_time.append({"date": day.strftime("%Y-%m-%d"), "count": count})

    return {
        "stats": stats,
        "recent_activities": recent_activities,
        "tasks_by_status": status_dist,
        "findings_by_severity": severity_dist,
        "tasks_over_time": tasks_over_time,
    }
