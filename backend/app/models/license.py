"""License model."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import JSON,  DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class License(BaseModel):
    """License - software license tracking."""

    __tablename__ = "licenses"

    license_key: Mapped[str] = mapped_column(String(500), nullable=False, unique=True, index=True)
    license_type: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True, default="enterprise"
    )
    holder_name: Mapped[str] = mapped_column(String(255), nullable=False)
    holder_email: Mapped[str] = mapped_column(String(255), nullable=False)
    max_users: Mapped[int] = mapped_column(default=10, nullable=False)
    max_projects: Mapped[int] = mapped_column(default=50, nullable=False)
    max_agents: Mapped[int] = mapped_column(default=5, nullable=False)
    features: Mapped[Optional[list[str]]] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    revoked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    signature: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
