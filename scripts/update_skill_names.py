"""直接更新数据库中的技能 display_name"""
import os, sys, asyncio

# 添加 backend 到 sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

os.environ['DOTENV_PATH'] = os.path.join(os.path.dirname(__file__), '..', '.env')

import django
# 用 SQLAlchemy 直接更新
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.config import Settings
settings = Settings()

# 导入映射
exec(open(os.path.join(os.path.dirname(__file__), 'skill_translations.py'), encoding='utf-8').read())

async def main():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    
    async with session_factory() as session:
        # 直接从 skills 表查
        result = await session.execute(
            select(settings.SKILL_TABLE).where(True)
        )
        # 用原始 SQL 更简单
        from sqlalchemy import text
        rows = await session.execute(text("SELECT id, name, display_name FROM skills"))
        skills = rows.fetchall()
        
        count = 0
        for row in skills:
            sid, name, old_dn = row
            cn = MAPPING.get(name)
            if not cn or old_dn == cn:
                continue
            await session.execute(
                text("UPDATE skills SET display_name = :dn WHERE id = :id"),
                {"dn": cn, "id": sid}
            )
            count += 1
            print(f'  ✅ {name} → {cn}')
        
        await session.commit()
        print(f'✅ 共更新 {count} 个技能')
    
    await engine.dispose()

if __name__ == '__main__':
    asyncio.run(main())
