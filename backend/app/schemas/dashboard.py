"""Dashboard schemas."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class DashboardStats(BaseModel):
    total_projects: int = 0
    active_projects: int = 0
    total_tasks: int = 0
    running_tasks: int = 0
    completed_tasks: int = 0
    failed_tasks: int = 0
    total_findings: int = 0
    critical_findings: int = 0
    high_findings: int = 0
    medium_findings: int = 0
    low_findings: int = 0
    info_findings: int = 0
    total_users: int = 0
    total_agents: int = 0


class RecentActivity(BaseModel):
    type: str
    description: str
    timestamp: str
    project_name: Optional[str] = None
    task_name: Optional[str] = None
    user_name: Optional[str] = None


class DashboardResponse(BaseModel):
    stats: DashboardStats
    recent_activities: list[RecentActivity] = []
    tasks_by_status: dict[str, int] = {}
    findings_by_severity: dict[str, int] = {}
    tasks_over_time: list[dict] = []
