"""Project model."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import JSON,  DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.agent import Agent
    from app.models.report import Report
    from app.models.task import Task
    from app.models.user import User
    from app.models.workflow import Workflow


class ProjectStatus:
    ACTIVE = "active"
    ARCHIVED = "archived"
    COMPLETED = "completed"


class Project(BaseModel):
    """Project - a penetration testing engagement."""

    __tablename__ = "projects"

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), default=ProjectStatus.ACTIVE, nullable=False, index=True
    )
    scope: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    tags: Mapped[Optional[list[str]]] = mapped_column(JSON, nullable=True)
    settings: Mapped[Optional[dict]] = mapped_column(
        JSON, default=lambda: {}, nullable=False
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Foreign keys
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True
    )

    # Relationships
    owner: Mapped["User"] = relationship("User", back_populates="projects")
    tasks: Mapped[list["Task"]] = relationship(
        "Task", back_populates="project", lazy="selectin"
    )
    workflows: Mapped[list["Workflow"]] = relationship(
        "Workflow", back_populates="project", lazy="selectin"
    )
    reports: Mapped[list["Report"]] = relationship(
        "Report", back_populates="project", lazy="selectin"
    )
    agents: Mapped[list["Agent"]] = relationship(
        "Agent", back_populates="project", lazy="selectin"
    )
