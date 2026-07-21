"""Elasticsearch service for findings indexing and search."""

from __future__ import annotations

from typing import Any, Optional

from elasticsearch import AsyncElasticsearch

from app.config import get_settings
from app.core.logging import logger

settings = get_settings()


class ElasticsearchService:
    """Service for Elasticsearch indexing and search operations."""

    def __init__(self) -> None:
        self.client: Optional[AsyncElasticsearch] = None

    async def connect(self) -> None:
        """Initialize the Elasticsearch client."""
        try:
            self.client = AsyncElasticsearch(
                settings.ELASTICSEARCH_URL,
                request_timeout=30,
            )
            if await self.client.ping():
                logger.info("elasticsearch_connected", url=settings.ELASTICSEARCH_URL)
            else:
                logger.warning("elasticsearch_ping_failed")
        except Exception as exc:
            logger.error("elasticsearch_connection_failed", error=str(exc))
            self.client = None

    async def close(self) -> None:
        """Close the Elasticsearch client."""
        if self.client:
            await self.client.close()
            self.client = None

    @property
    def findings_index(self) -> str:
        return f"{settings.ELASTICSEARCH_INDEX_PREFIX}_findings"

    async def index_finding(self, finding_id: str, document: dict[str, Any]) -> bool:
        """Index a finding document."""
        if self.client is None:
            return False
        try:
            await self.client.index(
                index=self.findings_index,
                id=finding_id,
                document=document,
            )
            return True
        except Exception as exc:
            logger.error("elasticsearch_index_error", error=str(exc))
            return False

    async def search_findings(
        self,
        query: str,
        severity: Optional[str] = None,
        project_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict[str, Any]:
        """Search findings with filters."""
        if self.client is None:
            return {"items": [], "total": 0}

        must_clauses: list[dict] = [
            {"multi_match": {"query": query, "fields": ["title^3", "description^2", "evidence"]}}
        ]

        filters: list[dict] = []
        if severity:
            filters.append({"term": {"severity": severity}})
        if project_id:
            filters.append({"term": {"project_id": project_id}})

        body = {
            "query": {
                "bool": {
                    "must": must_clauses,
                    "filter": filters,
                }
            },
            "from": (page - 1) * page_size,
            "size": page_size,
            "sort": [{"created_at": {"order": "desc"}}],
        }

        try:
            response = await self.client.search(index=self.findings_index, body=body)
            hits = response["hits"]
            return {
                "items": [hit["_source"] for hit in hits["hits"]],
                "total": hits["total"]["value"],
            }
        except Exception as exc:
            logger.error("elasticsearch_search_error", error=str(exc))
            return {"items": [], "total": 0}

    async def delete_finding(self, finding_id: str) -> bool:
        """Delete a finding document."""
        if self.client is None:
            return False
        try:
            await self.client.delete(index=self.findings_index, id=finding_id)
            return True
        except Exception:
            return False
