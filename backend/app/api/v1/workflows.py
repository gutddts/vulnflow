"""Workflows API endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.workflow import Workflow, WorkflowEdge, WorkflowNode
from app.models.user import User
from app.schemas.workflow import (
    WorkflowCreate,
    WorkflowEdgeCreate,
    WorkflowListResponse,
    WorkflowNodeCreate,
    WorkflowResponse,
    WorkflowUpdate,
)

router = APIRouter()


@router.post("", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
async def create_workflow(
    body: WorkflowCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Workflow:
    """Create a new workflow with nodes and edges."""
    workflow = Workflow(
        name=body.name,
        description=body.description,
        version=body.version,
        config=body.config,
        parallelism=body.parallelism,
        retry_count=body.retry_count,
        retry_delay_seconds=body.retry_delay_seconds,
        timeout_seconds=body.timeout_seconds,
        project_id=body.project_id,
    )
    db.add(workflow)
    await db.flush()

    # Create nodes
    node_map: dict[int, UUID] = {}
    for idx, node_data in enumerate(body.nodes):
        node = WorkflowNode(
            workflow_id=workflow.id,
            skill_id=node_data.skill_id,
            label=node_data.label,
            position_x=node_data.position_x,
            position_y=node_data.position_y,
            config=node_data.config,
            retry_count=node_data.retry_count,
            timeout_seconds=node_data.timeout_seconds,
        )
        db.add(node)
        node_map[idx] = node.id

    await db.flush()

    # Create edges
    for edge_data in body.edges:
        edge = WorkflowEdge(
            workflow_id=workflow.id,
            source_node_id=edge_data.source_node_id,
            target_node_id=edge_data.target_node_id,
            condition=edge_data.condition,
            label=edge_data.label,
        )
        db.add(edge)

    await db.flush()
    await db.refresh(workflow)
    return workflow


@router.get("", response_model=WorkflowListResponse)
async def list_workflows(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    project_id: UUID | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> dict:
    """List workflows, optionally filtered by project."""
    query = select(Workflow)

    if project_id:
        query = query.where(Workflow.project_id == project_id)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(Workflow.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = list(result.scalars().all())

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Workflow:
    """Get a single workflow with its nodes and edges."""
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
    return workflow


@router.put("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: UUID,
    body: WorkflowUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Workflow:
    """Update a workflow. Replaces nodes/edges if provided."""
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")

    update_data = body.model_dump(exclude_unset=True, exclude={"nodes", "edges"})
    for field, value in update_data.items():
        setattr(workflow, field, value)

    # Replace nodes if provided
    if body.nodes is not None:
        # Delete existing nodes and edges
        existing_nodes = await db.execute(
            select(WorkflowNode).where(WorkflowNode.workflow_id == workflow_id)
        )
        for node in existing_nodes.scalars().all():
            await db.delete(node)
        existing_edges = await db.execute(
            select(WorkflowEdge).where(WorkflowEdge.workflow_id == workflow_id)
        )
        for edge in existing_edges.scalars().all():
            await db.delete(edge)
        await db.flush()

        node_map: dict[int, UUID] = {}
        for idx, node_data in enumerate(body.nodes):
            node = WorkflowNode(
                workflow_id=workflow.id,
                skill_id=node_data.skill_id,
                label=node_data.label,
                position_x=node_data.position_x,
                position_y=node_data.position_y,
                config=node_data.config,
                retry_count=node_data.retry_count,
                timeout_seconds=node_data.timeout_seconds,
            )
            db.add(node)
            node_map[idx] = node.id
        await db.flush()

        if body.edges is not None:
            for edge_data in body.edges:
                edge = WorkflowEdge(
                    workflow_id=workflow.id,
                    source_node_id=edge_data.source_node_id,
                    target_node_id=edge_data.target_node_id,
                    condition=edge_data.condition,
                    label=edge_data.label,
                )
                db.add(edge)

    await db.flush()
    await db.refresh(workflow)
    return workflow


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_workflow(
    workflow_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a workflow."""
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
    await db.delete(workflow)
    await db.flush()
