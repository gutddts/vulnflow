"""Task schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class TaskBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    priority: int = Field(default=0)
    node_results: Optional[dict] = None


class TaskCreate(TaskBase):
    project_id: UUID
    workflow_id: Optional[UUID] = None
    parent_task_id: Optional[UUID] = None


class TaskUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=255)
    status: Optional[str] = None
    priority: Optional[int] = None
    progress: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    result: Optional[dict] = None
    error_message: Optional[str] = None
    node_results: Optional[dict] = None


class TaskResponse(TaskBase):
    id: UUID
    project_id: UUID
    workflow_id: Optional[UUID] = None
    parent_task_id: Optional[UUID] = None
    status: str
    progress: float
    current_node_id: Optional[str] = None
    result: Optional[dict] = None
    log: Optional[list[dict]] = None
    error_message: Optional[str] = None
    celery_task_id: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    execution_time_ms: Optional[int] = None
    retry_count: int
    node_results: Optional[dict] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskListResponse(BaseModel):
    items: list[TaskResponse]
    total: int
    page: int
    page_size: int


class TaskLogEntry(BaseModel):
    timestamp: str
    level: str
    node_id: Optional[str] = None
    message: str
    data: Optional[dict] = None
