"""Agent service - business logic for AI agent management."""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent


class AgentService:
    """Service for agent-related business logic."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, agent_id: UUID) -> Agent | None:
        result = await self.db.execute(select(Agent).where(Agent.id == agent_id))
        return result.scalar_one_or_none()

    async def list_by_owner(
        self,
        owner_id: UUID,
        page: int = 1,
        page_size: int = 20,
        agent_type: Optional[str] = None,
        project_id: Optional[UUID] = None,
    ) -> tuple[list[Agent], int]:
        query = select(Agent).where(Agent.owner_id == owner_id)

        if agent_type:
            query = query.where(Agent.agent_type == agent_type)
        if project_id:
            query = query.where(Agent.project_id == project_id)

        count = (await self.db.execute(
            select(func.count()).select_from(query.subquery())
        )).scalar() or 0

        query = query.order_by(Agent.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)
        return list(result.scalars().all()), count

    async def create_agent(self, **kwargs) -> Agent:
        agent = Agent(**kwargs)
        self.db.add(agent)
        await self.db.flush()
        await self.db.refresh(agent)
        return agent

    async def update_agent(self, agent: Agent, **kwargs) -> Agent:
        for field, value in kwargs.items():
            if value is not None:
                setattr(agent, field, value)
        await self.db.flush()
        await self.db.refresh(agent)
        return agent

    async def get_default_system_prompt(self, agent_type: str) -> str:
        """Return a default system prompt based on agent type."""
        prompts = {
            "reconnaissance": (
                "You are a reconnaissance agent specialized in gathering information "
                "about target systems. Use passive and active techniques to enumerate "
                "hosts, services, and potential vulnerabilities."
            ),
            "scanner": (
                "You are a vulnerability scanning agent. Your role is to identify "
                "security weaknesses in target systems using automated tools and "
                "manual analysis techniques."
            ),
            "exploitation": (
                "You are an exploitation agent. You attempt to exploit discovered "
                "vulnerabilities to demonstrate impact, always following the rules "
                "of engagement and scope limitations."
            ),
            "reporting": (
                "You are a reporting agent. Your role is to compile findings, "
                "assess severity, and generate comprehensive penetration testing "
                "reports with actionable remediation steps."
            ),
        }
        return prompts.get(
            agent_type,
            "You are a penetration testing AI agent. Follow the rules of engagement "
            "and scope limitations at all times.",
        )
