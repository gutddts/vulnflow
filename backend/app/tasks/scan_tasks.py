"""Celery tasks for vulnerability scanning operations."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select

from app.core.database import async_session_factory
from app.core.logging import logger
from app.models.finding import Finding
from app.models.task import Task, TaskStatus
from app.tasks.celery_app import celery_app


@celery_app.task(bind=True, max_retries=2)
def process_scan_results(
    self,
    task_id: str,
    scan_output: str,
) -> dict:
    """Process raw scan output into structured findings."""
    import asyncio

    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(
            _process_scan_results_async(task_id, scan_output)
        )
        return result
    except Exception as exc:
        logger.error("scan_process_error", task_id=task_id, error=str(exc))
        raise self.retry(exc=exc, countdown=60)
    finally:
        loop.close()


async def _process_scan_results_async(task_id: str, scan_output: str) -> dict:
    """Parse scan output and create Finding records."""
    async with async_session_factory() as db:
        result = await db.execute(select(Task).where(Task.id == UUID(task_id)))
        task = result.scalar_one_or_none()

        if task is None:
            return {"success": False, "error": "Task not found"}

        try:
            output_data = json.loads(scan_output)
        except json.JSONDecodeError:
            output_data = {"raw": scan_output}

        findings_created = 0

        # Handle different scanner output formats
        findings_list = output_data if isinstance(output_data, list) else output_data.get("findings", [output_data])

        for item in findings_list:
            if not isinstance(item, dict):
                continue

            finding = Finding(
                task_id=UUID(task_id),
                title=item.get("title", item.get("name", "Untitled Finding")),
                description=item.get("description", ""),
                severity=item.get("severity", "info").lower(),
                cvss_score=item.get("cvss_score"),
                cvss_vector=item.get("cvss_vector"),
                cwe_id=item.get("cwe_id"),
                affected_host=item.get("host", item.get("affected_host")),
                affected_port=item.get("port", item.get("affected_port")),
                affected_service=item.get("service", item.get("affected_service")),
                evidence=item.get("evidence", ""),
                remediation=item.get("remediation", ""),
                references=item.get("references"),
                raw_output=json.dumps(item),
                confidence=item.get("confidence", 1.0),
                tags=item.get("tags"),
                metadata=item.get("metadata", {}),
            )
            db.add(finding)
            findings_created += 1

        await db.commit()

        logger.info(
            "scan_results_processed",
            task_id=task_id,
            findings_count=findings_created,
        )

        return {
            "success": True,
            "findings_created": findings_created,
        }
