"""Workflow model - orchestration of skills for penetration testing."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import JSON,  ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.skill import Skill
    from app.models.task import Task


class Workflow(BaseModel):
    """Workflow - a sequence of skill executions forming a penetration test."""

    __tablename__ = "workflows"

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    version: Mapped[str] = mapped_column(String(50), nullable=False, default="1.0.0")
    status: Mapped[str] = mapped_column(
        String(50), default="draft", nullable=False, index=True
    )
    config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    parallelism: Mapped[int] = mapped_column(default=1, nullable=False)
    retry_count: Mapped[int] = mapped_column(default=0, nullable=False)
    retry_delay_seconds: Mapped[int] = mapped_column(default=30, nullable=False)
    timeout_seconds: Mapped[int] = mapped_column(default=3600, nullable=False)

    # Foreign keys
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="workflows")
    nodes: Mapped[list["WorkflowNode"]] = relationship(
        "WorkflowNode", back_populates="workflow", lazy="selectin", cascade="all, delete-orphan"
    )
    edges: Mapped[list["WorkflowEdge"]] = relationship(
        "WorkflowEdge", back_populates="workflow", lazy="selectin", cascade="all, delete-orphan"
    )
    tasks: Mapped[list["Task"]] = relationship(
        "Task", back_populates="workflow", lazy="selectin"
    )


class WorkflowNode(BaseModel):
    """A node in a workflow graph, referencing a Skill."""

    __tablename__ = "workflow_nodes"

    workflow_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("skills.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    position_x: Mapped[float] = mapped_column(default=0.0, nullable=False)
    position_y: Mapped[float] = mapped_column(default=0.0, nullable=False)
    config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    retry_count: Mapped[int] = mapped_column(default=0, nullable=False)
    timeout_seconds: Mapped[int] = mapped_column(default=300, nullable=False)

    # Relationships
    workflow: Mapped["Workflow"] = relationship("Workflow", back_populates="nodes")
    skill: Mapped["Skill"] = relationship("Skill", back_populates="workflow_nodes")


class WorkflowEdge(BaseModel):
    """An edge in a workflow graph, connecting two nodes."""

    __tablename__ = "workflow_edges"

    workflow_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_node_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workflow_nodes.id", ondelete="CASCADE"), nullable=False
    )
    target_node_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workflow_nodes.id", ondelete="CASCADE"), nullable=False
    )
    condition: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    workflow: Mapped["Workflow"] = relationship("Workflow", back_populates="edges")
