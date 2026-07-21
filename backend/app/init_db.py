"""Database initialization script.

Creates all tables from SQLAlchemy models and seeds an admin account.
Usage (inside backend container or local venv):
    python -m app.init_db
"""

from __future__ import annotations

import asyncio
import sys

from sqlalchemy import select

from app.core.database import Base, async_session_factory, engine
from app.core.security import get_password_hash
from app.models.user import User

# Import all models so they are registered on Base.metadata
import app.models  # noqa: F401

ADMIN_EMAIL = "admin@vulnflow.local"
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin@123"
ADMIN_FULL_NAME = "管理员"


async def create_tables() -> None:
    """Create all tables from model metadata (drop first to rebuild)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("✓ 所有数据表已重建")


async def create_admin() -> None:
    """Create the admin account if it does not exist."""
    async with async_session_factory() as session:
        existing = await session.execute(
            select(User).where(User.email == ADMIN_EMAIL)
        )
        if existing.scalar_one_or_none() is not None:
            print(f"✓ 管理员账号已存在: {ADMIN_EMAIL}")
            return

        admin = User(
            email=ADMIN_EMAIL,
            username=ADMIN_USERNAME,
            hashed_password=get_password_hash(ADMIN_PASSWORD),
            full_name=ADMIN_FULL_NAME,
            role="admin",
            is_active=True,
            is_verified=True,
        )
        session.add(admin)
        await session.commit()
        print(f"✓ 管理员账号创建成功: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")


async def main() -> None:
    print("=" * 50)
    print("  VulnFlow 数据库初始化")
    print("=" * 50)
    try:
        await create_tables()
        await create_admin()
    except Exception as exc:
        print(f"✗ 初始化失败: {exc}", file=sys.stderr)
        raise
    finally:
        await engine.dispose()
    print("=" * 50)
    print("  初始化完成")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
