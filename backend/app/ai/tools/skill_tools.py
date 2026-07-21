"""LangChain tools for skill operations.

Provides tools that agents can use to interact with the skill registry:
    - list_skills: List available skills by category
    - search_skills: Search for skills by query
    - get_skill_details: Get detailed information about a skill
    - execute_skill: Execute a skill and return results
"""

from __future__ import annotations

import json
from typing import Any, Callable, Optional

from langchain_core.tools import tool


# ------------------------------------------------------------------ #
#  Factory function to create tools with a skill registry instance
# ------------------------------------------------------------------ #
def create_skill_tools(skill_registry: Any) -> list[Callable]:
    """Create a list of skill-related LangChain tools bound to a skill registry.

    Args:
        skill_registry: A SkillRegistry instance or compatible object

    Returns:
        List of tool functions ready for use with LangChain agents
    """

    @tool
    async def list_skills_tool(category: str = "") -> str:
        """列出可用的渗透测试技能。

        Args:
            category: 技能类别过滤（可选），如 reconnaissance, scanner, exploitation 等

        Returns:
            JSON 格式的技能列表
        """
        try:
            skills = await skill_registry.list_skills(category=category if category else None)
            result = []
            for skill in skills:
                result.append({
                    "id": str(skill.get("id", skill.get("skill_id", ""))),
                    "name": skill.get("display_name", skill.get("name", "")),
                    "category": skill.get("category", "general"),
                    "description": skill.get("description", "")[:200],
                })
            return json.dumps(result, ensure_ascii=False, indent=2)
        except Exception as exc:
            return f"获取技能列表失败: {str(exc)}"

    @tool
    async def search_skills_tool(query: str) -> str:
        """搜索渗透测试技能。

        Args:
            query: 搜索关键词

        Returns:
            JSON 格式的匹配技能列表
        """
        try:
            skills = await skill_registry.search_skills(query)
            result = []
            for skill in skills:
                result.append({
                    "id": str(skill.get("id", skill.get("skill_id", ""))),
                    "name": skill.get("display_name", skill.get("name", "")),
                    "category": skill.get("category", "general"),
                    "description": skill.get("description", ""),
                })
            return json.dumps(result, ensure_ascii=False, indent=2)
        except Exception as exc:
            return f"搜索技能失败: {str(exc)}"

    @tool
    async def get_skill_details_tool(skill_id: str) -> str:
        """获取技能的详细信息。

        Args:
            skill_id: 技能 ID

        Returns:
            JSON 格式的技能详细信息
        """
        try:
            skill = await skill_registry.get_skill(skill_id)
            if skill is None:
                return f"技能 {skill_id} 不存在"
            result = {
                "id": str(skill.get("id", skill.get("skill_id", ""))),
                "name": skill.get("display_name", skill.get("name", "")),
                "category": skill.get("category", ""),
                "description": skill.get("description", ""),
                "version": skill.get("version", ""),
                "image": skill.get("image", ""),
                "parameters": skill.get("parameters", {}),
                "input_schema": skill.get("input_schema", {}),
                "timeout": skill.get("timeout", 300),
            }
            return json.dumps(result, ensure_ascii=False, indent=2)
        except Exception as exc:
            return f"获取技能详情失败: {str(exc)}"

    @tool
    async def execute_skill_tool(skill_id: str, inputs: str = "{}") -> str:
        """执行一个渗透测试技能。

        Args:
            skill_id: 技能 ID
            inputs: JSON 格式的输入参数

        Returns:
            JSON 格式的执行结果
        """
        try:
            params = json.loads(inputs) if inputs else {}
            result = await skill_registry.execute_skill(skill_id, params)
            return json.dumps(result, ensure_ascii=False, indent=2)
        except json.JSONDecodeError:
            return "参数格式错误，请提供有效的 JSON"
        except Exception as exc:
            return f"执行技能失败: {str(exc)}"

    return [list_skills_tool, search_skills_tool, get_skill_details_tool, execute_skill_tool]


# ------------------------------------------------------------------ #
#  Standalone tools (used when skill_registry is not available)
# ------------------------------------------------------------------ #
@tool
async def list_skills_tool(category: str = "") -> str:
    """列出可用的渗透测试技能。需要先初始化 skill_registry。"""
    return '{"error": "Skill registry not initialized", "skills": []}'


@tool
async def search_skills_tool(query: str) -> str:
    """搜索渗透测试技能。需要先初始化 skill_registry。"""
    return '{"error": "Skill registry not initialized", "skills": []}'


@tool
async def get_skill_details_tool(skill_id: str) -> str:
    """获取技能详细信息。需要先初始化 skill_registry。"""
    return '{"error": "Skill registry not initialized"}'


@tool
async def execute_skill_tool(skill_id: str, inputs: str = "{}") -> str:
    """执行一个渗透测试技能。需要先初始化 skill_registry。"""
    return '{"error": "Skill registry not initialized"}'
