"""Report service - business logic for report generation."""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finding import Finding
from app.models.report import Report
from app.models.task import Task


class ReportService:
    """Service for report-related business logic."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, report_id: UUID) -> Report | None:
        result = await self.db.execute(select(Report).where(Report.id == report_id))
        return result.scalar_one_or_none()

    async def list_reports(
        self,
        project_id: Optional[UUID] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Report], int]:
        query = select(Report)
        if project_id:
            query = query.where(Report.project_id == project_id)

        count = (await self.db.execute(
            select(func.count()).select_from(query.subquery())
        )).scalar() or 0

        query = query.order_by(Report.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)
        return list(result.scalars().all()), count

    async def create_report(
        self,
        title: str,
        project_id: UUID,
        description: Optional[str] = None,
        format: str = "pdf",
        template_id: Optional[str] = None,
    ) -> Report:
        report = Report(
            title=title,
            description=description,
            format=format,
            template_id=template_id,
            project_id=project_id,
        )
        self.db.add(report)
        await self.db.flush()
        await self.db.refresh(report)
        return report

    async def generate_report_content(self, report: Report) -> dict:
        """Aggregate findings and generate report content."""
        # Get all findings for this project through tasks
        findings_query = (
            select(Finding)
            .join(Task, Finding.task_id == Task.id)
            .where(Task.project_id == report.project_id)
        )
        result = await self.db.execute(findings_query)
        findings = result.scalars().all()

        # Severity summary
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        for f in findings:
            severity_counts[f.severity] = severity_counts.get(f.severity, 0) + 1

        content = {
            "title": report.title,
            "generated_at": None,
            "findings": [
                {
                    "id": str(f.id),
                    "title": f.title,
                    "severity": f.severity,
                    "cvss_score": f.cvss_score,
                    "cwe_id": f.cwe_id,
                    "description": f.description,
                    "affected_host": f.affected_host,
                    "affected_port": f.affected_port,
                    "evidence": f.evidence,
                    "remediation": f.remediation,
                    "references": f.references,
                }
                for f in findings
            ],
            "severity_summary": severity_counts,
            "total_findings": len(findings),
        }

        # Update report stats
        report.content = content
        report.severity_summary = severity_counts
        report.findings_count = len(findings)
        report.critical_count = severity_counts["critical"]
        report.high_count = severity_counts["high"]
        report.medium_count = severity_counts["medium"]
        report.low_count = severity_counts["low"]
        report.info_count = severity_counts["info"]

        await self.db.flush()
        return content
