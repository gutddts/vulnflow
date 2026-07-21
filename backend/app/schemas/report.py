"""Report schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ReportBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    format: str = Field(default="pdf")
    template_id: Optional[str] = None


class ReportCreate(ReportBase):
    project_id: UUID


class ReportUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = None
    status: Optional[str] = None
    is_published: Optional[bool] = None
    template_id: Optional[str] = None


class FindingSummary(BaseModel):
    id: UUID
    title: str
    severity: str
    cvss_score: Optional[float] = None
    cwe_id: Optional[str] = None
    affected_host: Optional[str] = None

    model_config = {"from_attributes": True}


class ReportResponse(ReportBase):
    id: UUID
    project_id: UUID
    content: Optional[dict] = None
    summary: Optional[str] = None
    severity_summary: Optional[dict] = None
    file_path: Optional[str] = None
    file_size_bytes: int
    status: str
    is_published: bool
    published_at: Optional[str] = None
    findings_count: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    info_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReportListResponse(BaseModel):
    items: list[ReportResponse]
    total: int
    page: int
    page_size: int


class ReportGenerateRequest(BaseModel):
    template_id: Optional[str] = None
    include_findings: bool = True
    include_remediation: bool = True
    include_evidence: bool = True
    format: str = "pdf"
