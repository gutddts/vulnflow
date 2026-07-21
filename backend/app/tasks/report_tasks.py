"""Celery tasks for report generation."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from uuid import UUID

from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy import select

from app.config import get_settings
from app.core.database import async_session_factory
from app.core.logging import logger
from app.models.finding import Finding
from app.models.report import Report
from app.models.task import Task
from app.tasks.celery_app import celery_app

settings = get_settings()


@celery_app.task(bind=True, max_retries=3)
def generate_report_task(
    self,
    report_id: str,
    options: str = "{}",
) -> dict:
    """Generate a penetration testing report as PDF."""
    import asyncio

    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(
            _generate_report_async(report_id, options)
        )
        return result
    except Exception as exc:
        logger.error("report_generation_error", report_id=report_id, error=str(exc))
        raise self.retry(exc=exc, countdown=120)
    finally:
        loop.close()


async def _generate_report_async(report_id: str, options: str) -> dict:
    """Async report generation logic."""
    opts = json.loads(options) if options else {}

    async with async_session_factory() as db:
        result = await db.execute(select(Report).where(Report.id == UUID(report_id)))
        report = result.scalar_one_or_none()

        if report is None:
            return {"success": False, "error": "Report not found"}

        # Gather findings for this project
        findings_query = (
            select(Finding)
            .join(Task, Finding.task_id == Task.id)
            .where(Task.project_id == report.project_id)
        )
        findings_result = await db.execute(findings_query)
        findings = findings_result.scalars().all()

        # Build severity summary
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        for f in findings:
            severity_counts[f.severity] = severity_counts.get(f.severity, 0) + 1

        # Prepare template data
        template_data = {
            "report": {
                "title": report.title,
                "description": report.description,
                "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
            },
            "findings": [
                {
                    "title": f.title,
                    "severity": f.severity.upper(),
                    "cvss_score": f.cvss_score,
                    "cwe_id": f.cwe_id,
                    "description": f.description,
                    "affected_host": f.affected_host,
                    "affected_port": f.affected_port,
                    "affected_service": f.affected_service,
                    "evidence": f.evidence,
                    "remediation": f.remediation,
                    "references": f.references or [],
                }
                for f in findings
            ],
            "severity_summary": severity_counts,
            "total_findings": len(findings),
            "include_findings": opts.get("include_findings", True),
            "include_remediation": opts.get("include_remediation", True),
            "include_evidence": opts.get("include_evidence", True),
        }

        # Generate HTML from template
        html_content = await _render_template(report.template_id, template_data)

        # Convert to PDF
        pdf_bytes = await _html_to_pdf(html_content)

        # Save to disk
        reports_dir = "/app/reports"
        os.makedirs(reports_dir, exist_ok=True)

        filename = f"{report.id}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.pdf"
        file_path = os.path.join(reports_dir, filename)

        with open(file_path, "wb") as f:
            f.write(pdf_bytes)

        # Update report record
        report.content = template_data
        report.severity_summary = severity_counts
        report.summary = f"Penetration test report with {len(findings)} findings"
        report.file_path = file_path
        report.file_size_bytes = len(pdf_bytes)
        report.status = "completed"
        report.findings_count = len(findings)
        report.critical_count = severity_counts["critical"]
        report.high_count = severity_counts["high"]
        report.medium_count = severity_counts["medium"]
        report.low_count = severity_counts["low"]
        report.info_count = severity_counts["info"]

        await db.commit()

        logger.info(
            "report_generated",
            report_id=report_id,
            findings_count=len(findings),
            file_size=len(pdf_bytes),
        )

        return {
            "success": True,
            "file_path": file_path,
            "file_size": len(pdf_bytes),
            "findings_count": len(findings),
        }


async def _render_template(
    template_id: str | None,
    data: dict,
) -> str:
    """Render the report template with data."""
    templates_dir = os.path.join(os.path.dirname(__file__), "..", "..", "templates", "reports")
    if not os.path.exists(templates_dir):
        templates_dir = "/app/templates/reports"

    env = Environment(
        loader=FileSystemLoader(templates_dir),
        autoescape=select_autoescape(["html", "xml"]),
    )

    template_name = f"{template_id or 'default'}.html"
    try:
        template = env.get_template(template_name)
    except Exception:
        # Fallback to inline default template
        template = env.from_string(DEFAULT_REPORT_TEMPLATE)

    return template.render(**data)


async def _html_to_pdf(html_content: str) -> bytes:
    """Convert HTML to PDF using WeasyPrint."""
    try:
        from weasyprint import HTML
        pdf = HTML(string=html_content).write_pdf()
        return pdf
    except ImportError:
        logger.warning("weasyprint_not_available")
        # Fallback: return HTML as-is wrapped in a simple response
        return html_content.encode("utf-8")


DEFAULT_REPORT_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{{ report.title }}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
        h1 { color: #1a1a2e; border-bottom: 2px solid #e94560; padding-bottom: 10px; }
        h2 { color: #16213e; margin-top: 30px; }
        .meta { color: #666; font-size: 14px; margin-bottom: 30px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 30px; }
        .severity-critical { color: #7b0000; font-weight: bold; }
        .severity-high { color: #d32f2f; font-weight: bold; }
        .severity-medium { color: #f57c00; font-weight: bold; }
        .severity-low { color: #388e3c; font-weight: bold; }
        .severity-info { color: #1976d2; font-weight: bold; }
        .finding { border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px; }
        .finding h3 { margin-top: 0; }
        .field { margin-bottom: 8px; }
        .field-label { font-weight: bold; display: inline-block; width: 120px; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #1a1a2e; color: white; }
    </style>
</head>
<body>
    <h1>{{ report.title }}</h1>
    <div class="meta">
        <p><strong>Generated:</strong> {{ report.generated_at }}</p>
        {% if report.description %}<p><strong>Description:</strong> {{ report.description }}</p>{% endif %}
    </div>

    <h2>Executive Summary</h2>
    <div class="summary">
        <p>This report contains <strong>{{ total_findings }}</strong> findings from the penetration testing engagement.</p>
        <table>
            <tr><th>Severity</th><th>Count</th></tr>
            <tr><td class="severity-critical">Critical</td><td>{{ severity_summary.critical }}</td></tr>
            <tr><td class="severity-high">High</td><td>{{ severity_summary.high }}</td></tr>
            <tr><td class="severity-medium">Medium</td><td>{{ severity_summary.medium }}</td></tr>
            <tr><td class="severity-low">Low</td><td>{{ severity_summary.low }}</td></tr>
            <tr><td class="severity-info">Info</td><td>{{ severity_summary.info }}</td></tr>
        </table>
    </div>

    {% if include_findings %}
    <h2>Findings</h2>
    {% for finding in findings %}
    <div class="finding">
        <h3 class="severity-{{ finding.severity|lower }}">{{ finding.title }}</h3>
        <div class="field"><span class="field-label">Severity:</span> <span class="severity-{{ finding.severity|lower }}">{{ finding.severity }}</span></div>
        {% if finding.cvss_score %}<div class="field"><span class="field-label">CVSS Score:</span> {{ finding.cvss_score }}</div>{% endif %}
        {% if finding.cwe_id %}<div class="field"><span class="field-label">CWE ID:</span> {{ finding.cwe_id }}</div>{% endif %}
        {% if finding.affected_host %}<div class="field"><span class="field-label">Host:</span> {{ finding.affected_host }}{% if finding.affected_port %}:{{ finding.affected_port }}{% endif %}</div>{% endif %}
        {% if finding.affected_service %}<div class="field"><span class="field-label">Service:</span> {{ finding.affected_service }}</div>{% endif %}
        {% if finding.description %}<div class="field"><span class="field-label">Description:</span> {{ finding.description }}</div>{% endif %}
        {% if include_evidence and finding.evidence %}<div class="field"><span class="field-label">Evidence:</span> <pre>{{ finding.evidence }}</pre></div>{% endif %}
        {% if include_remediation and finding.remediation %}<div class="field"><span class="field-label">Remediation:</span> {{ finding.remediation }}</div>{% endif %}
        {% if finding.references %}
        <div class="field"><span class="field-label">References:</span>
            <ul>{% for ref in finding.references %}<li>{{ ref }}</li>{% endfor %}</ul>
        </div>
        {% endif %}
    </div>
    {% endfor %}
    {% endif %}
</body>
</html>"""
