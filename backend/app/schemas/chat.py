"""Chat schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ChatMessageCreate(BaseModel):
    content: str = Field(..., min_length=1)
    role: str = Field(default="user", pattern=r"^(user|assistant|system)$")


class ChatMessageResponse(BaseModel):
    id: UUID
    session_id: UUID
    role: str
    content: str
    tool_calls: Optional[list[dict]] = None
    tool_results: Optional[list[dict]] = None
    tokens_used: Optional[int] = None
    metadata: dict = Field(default_factory=dict)
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatSessionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    model: str = Field(default="gpt-4o")
    system_prompt: Optional[str] = None
    context: Optional[dict] = None
    project_id: Optional[UUID] = None


class ChatSessionUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=255)
    is_archived: Optional[bool] = None
    context: Optional[dict] = None


class ChatSessionResponse(BaseModel):
    id: UUID
    title: str
    model: str
    user_id: UUID
    project_id: Optional[UUID] = None
    is_archived: bool
    context: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChatSessionListResponse(BaseModel):
    items: list[ChatSessionResponse]
    total: int
    page: int
    page_size: int


class ChatStreamChunk(BaseModel):
    type: str = "text"  # text, tool_call, tool_result, error, done
    content: str = ""
    tool_name: Optional[str] = None
    metadata: Optional[dict] = None
