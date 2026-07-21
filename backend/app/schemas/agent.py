"""Agent schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class AgentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    agent_type: str = Field(default="reconnaissance")
    llm_provider: str = Field(default="openai")
    llm_model: str = Field(default="gpt-4o")
    system_prompt: Optional[str] = None
    allowed_skills: Optional[list[str]] = None
    config: Optional[dict] = None
    max_iterations: int = Field(default=10, ge=1, le=100)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)


class AgentCreate(AgentBase):
    owner_id: UUID
    project_id: Optional[UUID] = None


class AgentUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = None
    agent_type: Optional[str] = None
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    system_prompt: Optional[str] = None
    allowed_skills: Optional[list[str]] = None
    config: Optional[dict] = None
    is_active: Optional[bool] = None
    max_iterations: Optional[int] = Field(default=None, ge=1, le=100)
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    project_id: Optional[UUID] = None


class AgentResponse(AgentBase):
    id: UUID
    owner_id: UUID
    project_id: Optional[UUID] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AgentListResponse(BaseModel):
    items: list[AgentResponse]
    total: int
    page: int
    page_size: int
