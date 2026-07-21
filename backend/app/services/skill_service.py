"""Skill service - business logic for skill management."""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.skill import Skill


class SkillService:
    """Service for skill-related business logic."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, skill_id: UUID) -> Skill | None:
        result = await self.db.execute(select(Skill).where(Skill.id == skill_id))
        return result.scalar_one_or_none()

    async def get_by_name(self, name: str) -> Skill | None:
        result = await self.db.execute(select(Skill).where(Skill.name == name))
        return result.scalar_one_or_none()

    async def list_skills(
        self,
        page: int = 1,
        page_size: int = 50,
        category: Optional[str] = None,
        search: Optional[str] = None,
        enabled_only: bool = False,
    ) -> tuple[list[Skill], int]:
        query = select(Skill)

        if category:
            query = query.where(Skill.category == category)
        if search:
            query = query.where(
                (Skill.name.ilike(f"%{search}%"))
                | (Skill.display_name.ilike(f"%{search}%"))
            )
        if enabled_only:
            query = query.where(Skill.is_enabled == True)

        count = (await self.db.execute(
            select(func.count()).select_from(query.subquery())
        )).scalar() or 0

        query = query.order_by(Skill.category, Skill.name)
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)
        return list(result.scalars().all()), count

    async def list_categories(self) -> list[str]:
        result = await self.db.execute(
            select(Skill.category).distinct().order_by(Skill.category)
        )
        return [row[0] for row in result.all()]

    async def create_skill(self, **kwargs) -> Skill:
        skill = Skill(**kwargs)
        self.db.add(skill)
        await self.db.flush()
        await self.db.refresh(skill)
        return skill

    async def update_skill(self, skill: Skill, **kwargs) -> Skill:
        for field, value in kwargs.items():
            if value is not None:
                setattr(skill, field, value)
        await self.db.flush()
        await self.db.refresh(skill)
        return skill
