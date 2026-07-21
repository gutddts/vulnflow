"""Skills API endpoints."""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.skill import Skill
from app.models.user import User
from app.schemas.skill import SkillCreate, SkillListResponse, SkillResponse, SkillUpdate

router = APIRouter()

# 技能文件存储目录（后端 data/skills/）
SKILLS_DIR = Path(__file__).parent.parent.parent.parent / "data" / "skills"
SKILLS_DIR.mkdir(parents=True, exist_ok=True)


def parse_frontmatter(content: str) -> dict:
    """简单解析 YAML frontmatter"""
    fm: dict[str, str | list[str]] = {}
    match = re.match(r"^---\s*\n([\s\S]*?)\n---", content)
    if not match:
        return fm
    for line in match.group(1).split("\n"):
        m = re.match(r"^(\w[\w_-]*)\s*:\s*(.+)$", line)
        if not m:
            continue
        val: str | list[str] = m.group(2).strip()
        if val.startswith("[") and val.endswith("]"):
            val = [
                t.strip().strip("'\"").strip()
                for t in val[1:-1].split(",")
                if t.strip()
            ]
        elif val.startswith('"') and val.endswith('"'):
            val = val[1:-1]
        fm[m.group(1)] = val
    return fm


@router.post("", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
async def create_skill(
    body: SkillCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Skill:
    """Create a new skill definition."""
    existing = await db.execute(select(Skill).where(Skill.name == body.name))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Skill '{body.name}' already exists",
        )

    skill = Skill(**body.model_dump())
    db.add(skill)
    await db.flush()
    await db.refresh(skill)
    return skill


@router.get("", response_model=SkillListResponse)
async def list_skills(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    category: str | None = Query(default=None),
    search: str | None = Query(default=None),
    enabled_only: bool = Query(default=False),
) -> dict:
    """List available skills."""
    query = select(Skill)

    if category:
        query = query.where(Skill.category == category)
    if search:
        query = query.where(
            (Skill.name.ilike(f"%{search}%")) | (Skill.display_name.ilike(f"%{search}%"))
        )
    if enabled_only:
        query = query.where(Skill.is_enabled == True)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(Skill.category, Skill.name)
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = list(result.scalars().all())

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/{skill_id}", response_model=SkillResponse)
async def get_skill(
    skill_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Skill:
    """Get a single skill by ID."""
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if skill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")
    return skill


@router.put("/{skill_id}", response_model=SkillResponse)
async def update_skill(
    skill_id: UUID,
    body: SkillUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Skill:
    """Update a skill definition."""
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if skill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(skill, field, value)

    await db.flush()
    await db.refresh(skill)
    return skill


@router.delete("/{skill_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_skill(
    skill_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a skill definition."""
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if skill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")
    await db.delete(skill)
    await db.flush()


@router.get("/categories/list", response_model=list[str])
async def list_skill_categories(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[str]:
    """List all distinct skill categories."""
    result = await db.execute(select(Skill.category).distinct().order_by(Skill.category))
    return [row[0] for row in result.all()]


@router.post("/upload", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
async def upload_skill_md(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
) -> Skill:
    """Upload a .md skill file. 解析 frontmatter 自动入库."""
    if not file.filename or not file.filename.lower().endswith((".md", ".markdown", ".json", ".yaml", ".yml")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only .md/.json/.yaml files allowed")

    content = (await file.read()).decode("utf-8", errors="replace")
    fm = parse_frontmatter(content)
    base_name = file.filename.rsplit(".", 1)[0].lower().replace(" ", "_").replace("-", "_")

    name = fm.get("name", base_name) if isinstance(fm.get("name"), str) else base_name
    # 去重
    existing = await db.execute(select(Skill).where(Skill.name == name))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Skill '{name}' already exists")

    display_name = fm.get("display_name", name)
    description = fm.get("description", "")

    tags_list: list[str] = []
    raw_tags = fm.get("tags", [])
    if isinstance(raw_tags, list):
        tags_list = raw_tags
    elif isinstance(raw_tags, str):
        tags_list = [raw_tags]

    skill = Skill(
        name=name,
        display_name=display_name if isinstance(display_name, str) else name,
        description=str(description) if description else None,
        category=str(fm.get("category", "general")) if isinstance(fm.get("category"), str) else "general",
        version=str(fm.get("version", "1.0.0")) if isinstance(fm.get("version"), str) else "1.0.0",
        image="local",
        entrypoint="local",
        tags=tags_list,
        parameters={"raw_content": content},
    )
    db.add(skill)
    await db.flush()
    await db.refresh(skill)
    return skill


@router.post("/import-builtin", status_code=status.HTTP_200_OK)
async def import_builtin_skills(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    directory: str = Query(default="", description="md 文件目录路径"),
) -> dict:
    """从指定目录批量导入 .md 技能文件到数据库。"""
    if not directory:
        # 默认从前端 public/skills/
        directory = str(
            Path(__file__).resolve().parent.parent.parent.parent.parent
            / "frontend"
            / "public"
            / "skills"
        )
    dir_path = Path(directory)
    if not dir_path.is_dir():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Directory not found: {directory}")

    count = 0
    for md_file in sorted(dir_path.glob("*.md")):
        content = md_file.read_text(encoding="utf-8", errors="replace")
        fm = parse_frontmatter(content)
        base_name = md_file.stem.lower().replace(" ", "_").replace("-", "_")
        name = fm.get("name", base_name) if isinstance(fm.get("name"), str) else base_name

        # 跳过已存在的
        existing = await db.execute(select(Skill).where(Skill.name == name))
        if existing.scalar_one_or_none() is not None:
            continue

        display_name = fm.get("display_name", name)
        description = fm.get("description", "")

        tags_list: list[str] = []
        raw_tags = fm.get("tags", [])
        if isinstance(raw_tags, list):
            tags_list = raw_tags
        elif isinstance(raw_tags, str):
            tags_list = [raw_tags]

        skill = Skill(
            name=name,
            display_name=display_name if isinstance(display_name, str) else name,
            description=str(description) if description else None,
            category=str(fm.get("category", "general")) if isinstance(fm.get("category"), str) else "general",
            version=str(fm.get("version", "1.0.0")) if isinstance(fm.get("version"), str) else "1.0.0",
            image="local",
            entrypoint="local",
            tags=tags_list,
            parameters={"raw_content": content},
        )
        db.add(skill)
        count += 1

    if count > 0:
        await db.flush()

    return {"imported": count}
