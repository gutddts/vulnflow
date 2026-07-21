"""Finding model - discovered vulnerability."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import JSON,  ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.task import Task


class Finding(BaseModel):
    """Finding - a discovered vulnerability or issue."""

    __tablename__ = "findings"

    title: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    severity: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True, default="info"
    )
    cvss_score: Mapped[Optional[float]] = mapped_column(default=None, nullable=True)
    cvss_vector: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    cwe_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    affected_host: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    affected_port: Mapped[Optional[int]] = mapped_column(default=None, nullable=True)
    affected_service: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    evidence: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    remediation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    references: Mapped[Optional[list[str]]] = mapped_column(JSON, nullable=True)
    raw_output: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), default="open", nullable=False, index=True
    )
    is_false_positive: Mapped[bool] = mapped_column(default=False, nullable=False)
    confidence: Mapped[float] = mapped_column(default=1.0, nullable=False)
    tags: Mapped[Optional[list[str]]] = mapped_column(JSON, nullable=True)
    finding_metadata: Mapped[Optional[dict]] = mapped_column(
        JSON, default=lambda: {}, nullable=False
    )

    # Foreign keys
    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Relationships
    task: Mapped["Task"] = relationship("Task", back_populates="findings")
