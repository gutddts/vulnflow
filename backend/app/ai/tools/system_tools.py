"""System tools for task management and system operations."""

from __future__ import annotations

import json
import uuid
from typing import Any

from langchain_core.tools import tool


@tool
async def create_task_tool(
    name: str,
    description: str = "",
    project_id: str = "",
    priority: int = 0,
) -> str:
    """创建一个新的渗透测试任务。

    Args:
        name: 任务名称
        description: 任务描述
        project_id: 所属项目 ID
        priority: 优先级（0-10）

    Returns:
        JSON 格式的任务信息
    """
    task_id = str(uuid.uuid4())
    result = {
        "task_id": task_id,
        "name": name,
        "description": description,
        "project_id": project_id,
        "priority": priority,
        "status": "pending",
    }
    return json.dumps(result, ensure_ascii=False, indent=2)


@tool
async def get_task_status_tool(task_id: str) -> str:
    """获取任务的当前状态。

    Args:
        task_id: 任务 ID

    Returns:
        JSON 格式的任务状态信息
    """
    result = {
        "task_id": task_id,
        "status": "unknown",
        "progress": 0.0,
        "note": "任务状态查询功能将在后续版本中实现完整集成",
    }
    return json.dumps(result, ensure_ascii=False, indent=2)


@tool
async def update_task_status_tool(
    task_id: str,
    status: str,
    progress: float = 0.0,
    message: str = "",
) -> str:
    """更新任务状态。

    Args:
        task_id: 任务 ID
        status: 新状态（pending, queued, running, completed, failed, cancelled）
        progress: 进度百分比（0.0-100.0）
        message: 状态消息

    Returns:
        JSON 格式的更新结果
    """
    result = {
        "task_id": task_id,
        "status": status,
        "progress": progress,
        "message": message,
        "updated": True,
    }
    return json.dumps(result, ensure_ascii=False, indent=2)


@tool
async def get_system_info_tool() -> str:
    """获取系统信息和可用资源。

    Returns:
        JSON 格式的系统信息
    """
    import platform

    result = {
        "platform": platform.platform(),
        "python_version": platform.python_version(),
        "system": platform.system(),
        "note": "VulnFlow AI Orchestration System",
    }
    return json.dumps(result, ensure_ascii=False, indent=2)
