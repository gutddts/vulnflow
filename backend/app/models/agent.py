"""Agent model - AI agent instance for penetration testing."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import JSON,  Boolean, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User


class Agent(BaseModel):
    """Agent - an AI-driven penetration testing agent."""

    __tablename__ = "agents"

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    agent_type: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True, default="reconnaissance"
    )
    llm_provider: Mapped[str] = mapped_column(String(100), nullable=False, default="openai")
    llm_model: Mapped[str] = mapped_column(String(100), nullable=False, default="gpt-4o")
    system_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    allowed_skills: Mapped[Optional[list[str]]] = mapped_column(JSON, nullable=True)
    config: Mapped[Optional[dict]] = mapped_column(
        JSON, default=lambda: {}, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    max_iterations: Mapped[int] = mapped_column(default=10, nullable=False)
    temperature: Mapped[float] = mapped_column(default=0.7, nullable=False)

    # Foreign keys
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Relationships
    owner: Mapped["User"] = relationship("User", back_populates="agents")
    project: Mapped[Optional["Project"]] = relationship("Project", back_populates="agents")
