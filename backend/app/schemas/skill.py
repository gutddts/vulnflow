"""Skill schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class SkillBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    display_name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    category: str = Field(default="general")
    version: str = Field(default="1.0.0")
    image: str = Field(..., max_length=500)
    entrypoint: str = Field(..., max_length=500)
    parameters: Optional[dict] = None
    required_capabilities: Optional[list[str]] = None
    timeout: int = Field(default=300, ge=1)
    max_memory_mb: int = Field(default=512, ge=64)
    max_cpu: float = Field(default=1.0, gt=0)
    environment_vars: Optional[dict] = None
    input_schema: Optional[dict] = None
    output_schema: Optional[dict] = None
    tags: Optional[list[str]] = None


class SkillCreate(SkillBase):
    pass


class SkillUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = None
    category: Optional[str] = None
    version: Optional[str] = None
    image: Optional[str] = Field(default=None, max_length=500)
    entrypoint: Optional[str] = Field(default=None, max_length=500)
    parameters: Optional[dict] = None
    required_capabilities: Optional[list[str]] = None
    timeout: Optional[int] = Field(default=None, ge=1)
    max_memory_mb: Optional[int] = Field(default=None, ge=64)
    max_cpu: Optional[float] = Field(default=None, gt=0)
    environment_vars: Optional[dict] = None
    input_schema: Optional[dict] = None
    output_schema: Optional[dict] = None
    is_enabled: Optional[bool] = None
    tags: Optional[list[str]] = None


class SkillResponse(SkillBase):
    id: UUID
    is_enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SkillListResponse(BaseModel):
    items: list[SkillResponse]
    total: int
    page: int
    page_size: int
