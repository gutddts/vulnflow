"""Workflow schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ------------------------------------------------------------------ #
#  Workflow Node / Edge
# ------------------------------------------------------------------ #
class WorkflowNodeBase(BaseModel):
    skill_id: UUID
    label: str = Field(..., max_length=255)
    position_x: float = Field(default=0.0)
    position_y: float = Field(default=0.0)
    config: Optional[dict] = None
    retry_count: int = Field(default=0, ge=0)
    timeout_seconds: int = Field(default=300, ge=1)


class WorkflowNodeCreate(WorkflowNodeBase):
    pass


class WorkflowNodeResponse(WorkflowNodeBase):
    id: UUID
    workflow_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkflowEdgeBase(BaseModel):
    source_node_id: UUID
    target_node_id: UUID
    condition: Optional[str] = Field(default=None, max_length=500)
    label: Optional[str] = Field(default=None, max_length=255)


class WorkflowEdgeCreate(WorkflowEdgeBase):
    pass


class WorkflowEdgeResponse(WorkflowEdgeBase):
    id: UUID
    workflow_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ------------------------------------------------------------------ #
#  Workflow
# ------------------------------------------------------------------ #
class WorkflowBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    version: str = Field(default="1.0.0")
    config: Optional[dict] = None
    parallelism: int = Field(default=1, ge=1)
    retry_count: int = Field(default=0, ge=0)
    retry_delay_seconds: int = Field(default=30, ge=0)
    timeout_seconds: int = Field(default=3600, ge=1)


class WorkflowCreate(WorkflowBase):
    project_id: UUID
    nodes: list[WorkflowNodeCreate] = Field(default_factory=list)
    edges: list[WorkflowEdgeCreate] = Field(default_factory=list)


class WorkflowUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    version: Optional[str] = None
    status: Optional[str] = None
    config: Optional[dict] = None
    parallelism: Optional[int] = Field(default=None, ge=1)
    retry_count: Optional[int] = Field(default=None, ge=0)
    retry_delay_seconds: Optional[int] = Field(default=None, ge=0)
    timeout_seconds: Optional[int] = Field(default=None, ge=1)
    nodes: Optional[list[WorkflowNodeCreate]] = None
    edges: Optional[list[WorkflowEdgeCreate]] = None


class WorkflowResponse(WorkflowBase):
    id: UUID
    project_id: UUID
    status: str
    nodes: list[WorkflowNodeResponse] = Field(default_factory=list)
    edges: list[WorkflowEdgeResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkflowListResponse(BaseModel):
    items: list[WorkflowResponse]
    total: int
    page: int
    page_size: int
