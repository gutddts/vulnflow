"""
技能注册中心 - 管理所有安全扫描技能的注册、发现、构建和测试
"""
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class SkillRegistry:
    """技能注册中心，负责技能的生命周期管理"""

    def __init__(self, db_session: AsyncSession, qdrant_client=None):
        self.db = db_session
        self.qdrant = qdrant_client
        self._collection_name = "vulnflow_skills"

    async def _ensure_collection(self):
        """确保 Qdrant 集合存在"""
        if self.qdrant is None:
            return
        try:
            collections = self.qdrant.get_collections()
            collection_names = [c.name for c in collections.collections]
            if self._collection_name not in collection_names:
                from qdrant_client.models import Distance, VectorParams

                self.qdrant.create_collection(
                    collection_name=self._collection_name,
                    vectors_config=VectorParams(
                        size=768,
                        distance=Distance.COSINE,
                    ),
                )
                logger.info("已创建 Qdrant 集合: %s", self._collection_name)
        except Exception as e:
            logger.error("创建 Qdrant 集合失败: %s", e)

    async def register(self, skill_def: Dict[str, Any]) -> Dict[str, Any]:
        """
        注册技能定义到 PostgreSQL 和 Qdrant 向量数据库

        Args:
            skill_def: 技能定义字典，包含 id, name, description, category, type,
                       image, inputs, outputs, timeout, resource_limits, metadata

        Returns:
            注册后的技能定义
        """
        skill_id = skill_def.get("id") or str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        # 存储到 PostgreSQL
        query = text("""
            INSERT INTO skills (id, name, description, category, skill_type,
                               image, inputs, outputs, timeout_seconds,
                               resource_limits, metadata, created_at, updated_at)
            VALUES (:id, :name, :description, :category, :skill_type,
                    :image, :inputs, :outputs, :timeout_seconds,
                    :resource_limits, :metadata, :created_at, :updated_at)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                category = EXCLUDED.category,
                skill_type = EXCLUDED.skill_type,
                image = EXCLUDED.image,
                inputs = EXCLUDED.inputs,
                outputs = EXCLUDED.outputs,
                timeout_seconds = EXCLUDED.timeout_seconds,
                resource_limits = EXCLUDED.resource_limits,
                metadata = EXCLUDED.metadata,
                updated_at = EXCLUDED.updated_at
            RETURNING *
        """)

        result = await self.db.execute(
            query,
            {
                "id": skill_id,
                "name": skill_def.get("name", ""),
                "description": skill_def.get("description", ""),
                "category": skill_def.get("category", ""),
                "skill_type": skill_def.get("type", ""),
                "image": skill_def.get("image", ""),
                "inputs": json.dumps(skill_def.get("inputs", {})),
                "outputs": json.dumps(skill_def.get("outputs", {})),
                "timeout_seconds": skill_def.get("timeout_seconds", 300),
                "resource_limits": json.dumps(skill_def.get("resource_limits", {})),
                "metadata": json.dumps(skill_def.get("metadata", {})),
                "created_at": now,
                "updated_at": now,
            },
        )
        await self.db.commit()

        row = result.fetchone()
        registered = self._row_to_dict(row)

        # 存储向量到 Qdrant
        if self.qdrant is not None:
            await self._ensure_collection()
            try:
                # 生成描述文本用于向量化
                search_text = (
                    f"{skill_def.get('name', '')} "
                    f"{skill_def.get('description', '')} "
                    f"{skill_def.get('category', '')} "
                    f"{skill_def.get('type', '')}"
                )

                # 使用 Qdrant 的内置向量化或预计算向量
                from qdrant_client.models import PointStruct

                self.qdrant.upsert(
                    collection_name=self._collection_name,
                    points=[
                        PointStruct(
                            id=skill_id,
                            vector={},  # 让 Qdrant 使用默认向量化
                            payload={
                                "skill_id": skill_id,
                                "name": skill_def.get("name", ""),
                                "description": skill_def.get("description", ""),
                                "category": skill_def.get("category", ""),
                                "skill_type": skill_def.get("type", ""),
                                "search_text": search_text,
                            },
                        )
                    ],
                )
            except Exception as e:
                logger.warning("存储向量到 Qdrant 失败: %s", e)

        return registered

    async def discover_skills_for_target(
        self, target_description: str, top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        基于目标描述通过语义搜索发现相关技能

        Args:
            target_description: 目标描述文本
            top_k: 返回的最大技能数量

        Returns:
            匹配的技能列表
        """
        if self.qdrant is None:
            # 回退到关键词搜索
            return await self.search_skills(query=target_description, page_size=top_k)

        await self._ensure_collection()
        try:
            # 从 Qdrant 搜索相似技能
            search_result = self.qdrant.search(
                collection_name=self._collection_name,
                query_vector={},
                query_text=target_description,
                limit=top_k,
            )

            skill_ids = [hit.id for hit in search_result]
            if not skill_ids:
                return []

            # 从 PostgreSQL 获取完整技能信息
            query = text("""
                SELECT * FROM skills
                WHERE id = ANY(:ids)
                ORDER BY array_position(:id_array, id)
            """)
            result = await self.db.execute(
                query,
                {"ids": skill_ids, "id_array": skill_ids},
            )
            rows = result.fetchall()
            return [self._row_to_dict(row) for row in rows]

        except Exception as e:
            logger.error("语义搜索技能失败: %s", e)
            return []

    async def get_recon_skills(self) -> List[Dict[str, Any]]:
        """
        获取所有侦察类技能

        Returns:
            侦察类技能列表
        """
        query = text("SELECT * FROM skills WHERE category = 'recon' ORDER BY name")
        result = await self.db.execute(query)
        rows = result.fetchall()
        return [self._row_to_dict(row) for row in rows]

    async def get_exploit_skills(self, vuln_type: str) -> List[Dict[str, Any]]:
        """
        根据漏洞类型获取利用类技能

        Args:
            vuln_type: 漏洞类型 (如 sqli, xss, rce)

        Returns:
            匹配的利用类技能列表
        """
        query = text("""
            SELECT * FROM skills
            WHERE category = 'exploit'
              AND (skill_type = :vuln_type
                   OR metadata->>'target_vuln_types' ? :vuln_type)
            ORDER BY name
        """)
        result = await self.db.execute(query, {"vuln_type": vuln_type})
        rows = result.fetchall()
        return [self._row_to_dict(row) for row in rows]

    async def search_skills(
        self,
        query: str = "",
        category: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        """
        搜索技能

        Args:
            query: 搜索关键词
            category: 按分类过滤
            page: 页码 (从 1 开始)
            page_size: 每页数量

        Returns:
            包含 items 和 total 的分页结果
        """
        conditions = []
        params = {}

        if query:
            conditions.append(
                "(name ILIKE :query OR description ILIKE :query)"
            )
            params["query"] = f"%{query}%"

        if category:
            conditions.append("category = :category")
            params["category"] = category

        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)

        # 统计总数
        count_query = text(f"SELECT COUNT(*) as total FROM skills {where_clause}")
        count_result = await self.db.execute(count_query, params)
        total = count_result.fetchone()[0]

        # 分页查询
        offset = (page - 1) * page_size
        data_query = text(f"""
            SELECT * FROM skills {where_clause}
            ORDER BY updated_at DESC
            LIMIT :limit OFFSET :offset
        """)
        params["limit"] = page_size
        params["offset"] = offset
        result = await self.db.execute(data_query, params)
        rows = result.fetchall()

        return {
            "items": [self._row_to_dict(row) for row in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    async def build_skill_image(self, skill_id: str) -> Dict[str, Any]:
        """
        构建技能的 Docker 镜像

        Args:
            skill_id: 技能 ID

        Returns:
            构建结果
        """
        # 获取技能信息
        query = text("SELECT * FROM skills WHERE id = :id")
        result = await self.db.execute(query, {"id": skill_id})
        row = result.fetchone()
        if not row:
            raise ValueError(f"技能不存在: {skill_id}")

        skill = self._row_to_dict(row)
        skill_name = skill["name"]

        # 构建镜像路径
        import os

        skills_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "skills")
        skill_dir = os.path.join(skills_dir, skill_name.replace(" ", "_").lower())

        if not os.path.exists(skill_dir):
            raise ValueError(f"技能目录不存在: {skill_dir}")

        dockerfile_path = os.path.join(skill_dir, "Dockerfile")
        if not os.path.exists(dockerfile_path):
            raise ValueError(f"Dockerfile 不存在: {dockerfile_path}")

        # 使用 Docker SDK 构建镜像
        try:
            import docker

            client = docker.from_env()
            image_tag = f"vulnflow/{skill_name.replace(' ', '-').lower()}:latest"

            logger.info("开始构建镜像: %s", image_tag)
            image, build_logs = client.images.build(
                path=skill_dir,
                tag=image_tag,
                rm=True,
                forcerm=True,
            )

            # 更新数据库中的镜像标签
            update_query = text("""
                UPDATE skills SET image = :image, updated_at = :updated_at
                WHERE id = :id
            """)
            await self.db.execute(
                update_query,
                {
                    "image": image_tag,
                    "updated_at": datetime.now(timezone.utc),
                    "id": skill_id,
                },
            )
            await self.db.commit()

            logger.info("镜像构建成功: %s", image_tag)
            return {
                "skill_id": skill_id,
                "image": image_tag,
                "status": "built",
                "image_id": image.id,
            }

        except Exception as e:
            logger.error("构建镜像失败: %s", e)
            raise RuntimeError(f"构建镜像失败: {e}")

    async def test_skill(
        self, skill_id: str, inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        测试运行技能

        Args:
            skill_id: 技能 ID
            inputs: 测试输入参数

        Returns:
            测试运行结果
        """
        # 获取技能信息
        query = text("SELECT * FROM skills WHERE id = :id")
        result = await self.db.execute(query, {"id": skill_id})
        row = result.fetchone()
        if not row:
            raise ValueError(f"技能不存在: {skill_id}")

        skill = self._row_to_dict(row)

        # 使用沙箱服务执行
        from .sandbox_service import SandboxService

        sandbox = SandboxService()
        task_id = str(uuid.uuid4())

        execution_result = await sandbox.execute_skill(
            skill=skill,
            inputs=inputs,
            task_id=task_id,
        )

        return execution_result

    def _row_to_dict(self, row) -> Dict[str, Any]:
        """将数据库行转换为字典"""
        if row is None:
            return {}

        columns = row._mapping.keys()
        result = {}
        for col in columns:
            value = row._mapping[col]
            if col in ("inputs", "outputs", "resource_limits", "metadata"):
                if isinstance(value, str):
                    try:
                        result[col] = json.loads(value)
                    except (json.JSONDecodeError, TypeError):
                        result[col] = value
                else:
                    result[col] = value
            elif isinstance(value, datetime):
                result[col] = value.isoformat()
            else:
                result[col] = value
        return result
