"""Workflow service - business logic for workflow orchestration."""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.workflow import Workflow, WorkflowEdge, WorkflowNode


class WorkflowService:
    """Service for workflow-related business logic."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, workflow_id: UUID) -> Workflow | None:
        result = await self.db.execute(select(Workflow).where(Workflow.id == workflow_id))
        return result.scalar_one_or_none()

    async def list_workflows(
        self,
        project_id: Optional[UUID] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Workflow], int]:
        query = select(Workflow)
        if project_id:
            query = query.where(Workflow.project_id == project_id)

        count = (await self.db.execute(
            select(func.count()).select_from(query.subquery())
        )).scalar() or 0

        query = query.order_by(Workflow.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)
        return list(result.scalars().all()), count

    async def create_workflow(
        self,
        name: str,
        project_id: UUID,
        description: Optional[str] = None,
        nodes: list[dict] | None = None,
        edges: list[dict] | None = None,
        **kwargs,
    ) -> Workflow:
        workflow = Workflow(name=name, project_id=project_id, description=description, **kwargs)
        self.db.add(workflow)
        await self.db.flush()

        if nodes:
            for node_data in nodes:
                node = WorkflowNode(
                    workflow_id=workflow.id,
                    skill_id=node_data["skill_id"],
                    label=node_data.get("label", ""),
                    position_x=node_data.get("position_x", 0.0),
                    position_y=node_data.get("position_y", 0.0),
                    config=node_data.get("config"),
                    retry_count=node_data.get("retry_count", 0),
                    timeout_seconds=node_data.get("timeout_seconds", 300),
                )
                self.db.add(node)

        await self.db.flush()

        if edges:
            for edge_data in edges:
                edge = WorkflowEdge(
                    workflow_id=workflow.id,
                    source_node_id=edge_data["source_node_id"],
                    target_node_id=edge_data["target_node_id"],
                    condition=edge_data.get("condition"),
                    label=edge_data.get("label"),
                )
                self.db.add(edge)

        await self.db.flush()
        await self.db.refresh(workflow)
        return workflow

    async def validate_workflow(self, workflow: Workflow) -> tuple[bool, str]:
        """Validate a workflow's graph structure."""
        if not workflow.nodes:
            return False, "Workflow has no nodes"

        node_ids = {n.id for n in workflow.nodes}
        for edge in workflow.edges:
            if edge.source_node_id not in node_ids:
                return False, f"Edge references non-existent source node {edge.source_node_id}"
            if edge.target_node_id not in node_ids:
                return False, f"Edge references non-existent target node {edge.target_node_id}"

        # Check for cycles using DFS
        if self._has_cycle(workflow):
            return False, "Workflow contains a cycle"

        return True, "Valid"

    def _has_cycle(self, workflow: Workflow) -> bool:
        """Detect cycles in the workflow graph using DFS."""
        adj: dict[UUID, list[UUID]] = {}
        for node in workflow.nodes:
            adj[node.id] = []

        for edge in workflow.edges:
            if edge.source_node_id in adj:
                adj[edge.source_node_id].append(edge.target_node_id)

        WHITE, GRAY, BLACK = 0, 1, 2
        color: dict[UUID, int] = {n.id: WHITE for n in workflow.nodes}

        def dfs(node_id: UUID) -> bool:
            color[node_id] = GRAY
            for neighbor in adj.get(node_id, []):
                if color.get(neighbor) == GRAY:
                    return True
                if color.get(neighbor) == WHITE and dfs(neighbor):
                    return True
            color[node_id] = BLACK
            return False

        for node in workflow.nodes:
            if color[node.id] == WHITE:
                if dfs(node.id):
                    return True
        return False
