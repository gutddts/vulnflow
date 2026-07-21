"""Report model."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import JSON,  ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.project import Project


class Report(BaseModel):
    """Report - generated penetration testing report."""

    __tablename__ = "reports"

    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    format: Mapped[str] = mapped_column(String(50), default="pdf", nullable=False)
    template_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    content: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    severity_summary: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    file_path: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    file_size_bytes: Mapped[Optional[int]] = mapped_column(default=0, nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), default="draft", nullable=False, index=True
    )
    is_published: Mapped[bool] = mapped_column(default=False, nullable=False)
    published_at: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    findings_count: Mapped[int] = mapped_column(default=0, nullable=False)
    critical_count: Mapped[int] = mapped_column(default=0, nullable=False)
    high_count: Mapped[int] = mapped_column(default=0, nullable=False)
    medium_count: Mapped[int] = mapped_column(default=0, nullable=False)
    low_count: Mapped[int] = mapped_column(default=0, nullable=False)
    info_count: Mapped[int] = mapped_column(default=0, nullable=False)

    # Foreign keys
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="reports")
