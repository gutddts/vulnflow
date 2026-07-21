"""Executor Agent - skill selection and invocation, workflow execution."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from langchain_core.language_models import BaseChatModel

from app.ai.agents.base import BaseAgent

logger = logging.getLogger(__name__)

DEFAULT_EXECUTOR_SYSTEM_PROMPT = """你是一名渗透测试执行专家。你的职责是：
1. 根据攻击计划执行指定的技能（Skills）
2. 监控技能执行进度
3. 收集执行结果
4. 处理技能执行失败的情况，进行重试或回退

你需要确保：
- 技能按正确的顺序执行
- 并行技能可以同时执行以提高效率
- 失败的技能根据重试策略处理
- 记录所有执行结果供分析使用
"""


class ExecutorAgent(BaseAgent):
    """Executor Agent for skill execution.

    Takes the attack plan and selected skills, creates Celery task signatures,
    monitors execution, and collects results.
    """

    def __init__(
        self,
        llm: BaseChatModel,
        tools: list[Any] | None = None,
        prompts: dict[str, str] | None = None,
        skill_registry: Any = None,
    ) -> None:
        super().__init__(llm, tools, prompts)
        self.skill_registry = skill_registry

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        selected_skills = state.get("selected_skills", [])
        attack_plan = state.get("attack_plan", {})
        current_phase = attack_plan.get("current_phase", 0)
        phases = attack_plan.get("phases", [])
        existing_results = dict(state.get("execution_results", {}))

        if current_phase >= len(phases):
            self._log("No more phases to execute")
            return {
                "execution_results": existing_results,
                "tool_calls": [],
            }

        current_phase_data = phases[current_phase]
        phase_skills = current_phase_data.get("skills", selected_skills)
        is_parallel = current_phase_data.get("parallel", False)

        self._log(
            f"Executing phase {current_phase + 1}: {current_phase_data.get('name')}, "
            f"skills: {phase_skills}, parallel: {is_parallel}"
        )

        results = dict(existing_results)
        tool_calls = list(state.get("tool_calls", []))

        if is_parallel and len(phase_skills) > 1:
            # Execute skills in parallel
            tasks = []
            for skill_id in phase_skills:
                tasks.append(self._execute_single_skill(skill_id, state))
            skill_results = await asyncio.gather(*tasks, return_exceptions=True)

            for skill_id, result in zip(phase_skills, skill_results):
                if isinstance(result, Exception):
                    results[skill_id] = {
                        "success": False,
                        "error": str(result),
                        "output": "",
                        "duration": 0,
                    }
                else:
                    results[skill_id] = result
        else:
            # Execute skills sequentially
            for skill_id in phase_skills:
                result = await self._execute_single_skill(skill_id, state)
                results[skill_id] = result

        # Record tool calls
        for skill_id, result in results.items():
            if skill_id not in existing_results:
                tool_calls.append({
                    "skill_id": skill_id,
                    "success": result.get("success", False),
                    "timestamp": time.time(),
                })

        status_messages = self._add_status(
            state,
            f"阶段执行完成: {len(results)} 个技能已执行",
        )

        return {
            "execution_results": results,
            "tool_calls": tool_calls,
            "status_messages": status_messages,
        }

    async def _execute_single_skill(
        self, skill_id: str, state: dict[str, Any]
    ) -> dict[str, Any]:
        """Execute a single skill and return its result.

        Attempts to use Celery task, falls back to direct Docker execution.
        """
        self._log(f"Executing skill: {skill_id}")
        start_time = time.time()

        try:
            # Try Celery task execution first
            result = await self._execute_via_celery(skill_id, state)
            duration = time.time() - start_time
            result["duration"] = duration
            return result
        except Exception as exc:
            self._log(f"Celery execution failed for {skill_id}: {exc}", "warning")
            # Fallback: try direct execution
            try:
                result = await self._execute_via_docker(skill_id, state)
                duration = time.time() - start_time
                result["duration"] = duration
                return result
            except Exception as fallback_exc:
                self._log(
                    f"Direct execution also failed for {skill_id}: {fallback_exc}",
                    "error",
                )
                return {
                    "success": False,
                    "error": str(fallback_exc),
                    "output": "",
                    "duration": time.time() - start_time,
                }

    async def _execute_via_celery(
        self, skill_id: str, state: dict[str, Any]
    ) -> dict[str, Any]:
        """Execute a skill via Celery task.

        Args:
            skill_id: The skill ID to execute
            state: Current agent state

        Returns:
            Execution result dict
        """
        from app.tasks.skill_tasks import execute_skill_task

        task_id = state.get("task_id", "unknown")

        # Submit Celery task
        celery_result = execute_skill_task.delay(
            skill_id=skill_id,
            task_id=task_id,
            parameters="{}",
        )

        # Wait for result with timeout
        try:
            result_data = celery_result.get(timeout=300)
            return {
                "success": result_data.get("success", False),
                "output": result_data.get("logs", result_data.get("stdout", "")),
                "error": result_data.get("error", ""),
                "exit_code": result_data.get("exit_code", -1),
            }
        except Exception as exc:
            return {
                "success": False,
                "error": f"Celery task failed: {str(exc)}",
                "output": "",
            }

    async def _execute_via_docker(
        self, skill_id: str, state: dict[str, Any]
    ) -> dict[str, Any]:
        """Execute a skill directly via Docker (fallback).

        Args:
            skill_id: The skill ID to execute
            state: Current agent state

        Returns:
            Execution result dict
        """
        from app.services.skill_executor import DockerSkillService

        if self.skill_registry is None:
            return {"success": False, "error": "Skill registry not available", "output": ""}

        skill = await self.skill_registry.get_skill(skill_id)
        if skill is None:
            return {"success": False, "error": f"Skill {skill_id} not found", "output": ""}

        executor = DockerSkillService()
        result = await executor.execute_skill(
            image=skill.get("image", ""),
            entrypoint=skill.get("entrypoint", ""),
            parameters=skill.get("parameters"),
            environment=skill.get("environment_vars"),
            timeout=skill.get("timeout", 300),
            max_memory_mb=skill.get("max_memory_mb", 512),
            max_cpu=skill.get("max_cpu", 1.0),
        )

        return {
            "success": result.get("success", False),
            "output": result.get("logs", result.get("stdout", "")),
            "error": result.get("error", ""),
            "exit_code": result.get("exit_code", -1),
        }
