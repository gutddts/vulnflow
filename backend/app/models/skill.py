"""Skill model - reusable penetration testing skill container."""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from sqlalchemy import JSON,  String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.workflow import WorkflowNode


class Skill(BaseModel):
    """Skill - a Docker-based penetration testing tool/script."""

    __tablename__ = "skills"

    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True, default="general"
    )
    version: Mapped[str] = mapped_column(String(50), nullable=False, default="1.0.0")
    image: Mapped[str] = mapped_column(String(500), nullable=False)
    entrypoint: Mapped[str] = mapped_column(String(500), nullable=False)
    parameters: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    required_capabilities: Mapped[Optional[list[str]]] = mapped_column(JSON, nullable=True)
    timeout: Mapped[int] = mapped_column(default=300, nullable=False)
    max_memory_mb: Mapped[int] = mapped_column(default=512, nullable=False)
    max_cpu: Mapped[float] = mapped_column(default=1.0, nullable=False)
    environment_vars: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    input_schema: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    output_schema: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    is_enabled: Mapped[bool] = mapped_column(default=True, nullable=False)
    tags: Mapped[Optional[list[str]]] = mapped_column(JSON, nullable=True)

    # Relationships
    workflow_nodes: Mapped[list["WorkflowNode"]] = relationship(
        "WorkflowNode", back_populates="skill", lazy="selectin"
    )
