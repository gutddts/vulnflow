"""Main Orchestrator for the VulnFlow multi-agent penetration testing system.

The Orchestrator:
    - Takes AgentConfig and SkillRegistry
    - Creates LLM provider
    - Initializes all agents (Planner, Executor, Analyzer, Evaluator, Reporter)
    - Builds the LangGraph workflow
    - Provides stream() async generator for SSE streaming
    - Provides invoke() for synchronous execution
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from typing import Any, AsyncGenerator, Optional

from app.ai.agents.analyzer import AnalyzerAgent
from app.ai.agents.evaluator import EvaluatorAgent
from app.ai.agents.executor import ExecutorAgent
from app.ai.agents.planner import PlannerAgent
from app.ai.agents.reporter import ReporterAgent
from app.ai.graph.state import AgentState
from app.ai.graph.supervisor import build_workflow
from app.ai.llm.factory import LLMProviderFactory
from app.ai.prompts.system import SYSTEM_PROMPTS

logger = logging.getLogger(__name__)


class SkillRegistry:
    """Abstract skill registry interface.

    In production, this is backed by the database and Docker skill execution.
    For testing/development, a mock can be used.
    """

    async def list_skills(self, category: Optional[str] = None) -> list[dict]:
        """List available skills, optionally filtered by category."""
        return []

    async def search_skills(self, query: str) -> list[dict]:
        """Search skills by query string."""
        return []

    async def get_skill(self, skill_id: str) -> Optional[dict]:
        """Get a single skill by ID."""
        return None

    async def execute_skill(self, skill_id: str, params: dict) -> dict:
        """Execute a skill and return results."""
        return {"success": False, "error": "Not implemented"}


class DatabaseSkillRegistry(SkillRegistry):
    """Skill registry backed by the database and Docker executor."""

    def __init__(self, db_session_factory=None) -> None:
        self._db_session_factory = db_session_factory

    async def list_skills(self, category: Optional[str] = None) -> list[dict]:
        try:
            from app.core.database import async_session_factory
            from sqlalchemy import select
            from app.models.skill import Skill

            factory = self._db_session_factory or async_session_factory
            async with factory() as db:
                query = select(Skill).where(Skill.is_enabled == True)
                if category:
                    query = query.where(Skill.category == category)
                result = await db.execute(query)
                skills = result.scalars().all()
                return [
                    {
                        "id": str(s.id),
                        "name": s.name,
                        "display_name": s.display_name,
                        "category": s.category,
                        "description": s.description,
                        "version": s.version,
                        "image": s.image,
                        "entrypoint": s.entrypoint,
                        "parameters": s.parameters,
                        "input_schema": s.input_schema,
                        "timeout": s.timeout,
                        "max_memory_mb": s.max_memory_mb,
                        "max_cpu": s.max_cpu,
                        "environment_vars": s.environment_vars,
                        "tags": s.tags,
                    }
                    for s in skills
                ]
        except Exception as exc:
            logger.warning(f"Failed to list skills from database: {exc}")
            return []

    async def search_skills(self, query: str) -> list[dict]:
        all_skills = await self.list_skills()
        query_lower = query.lower()
        return [
            s for s in all_skills
            if query_lower in s.get("name", "").lower()
            or query_lower in s.get("display_name", "").lower()
            or query_lower in s.get("description", "").lower()
            or query_lower in s.get("category", "").lower()
        ]

    async def get_skill(self, skill_id: str) -> Optional[dict]:
        try:
            from app.core.database import async_session_factory
            from sqlalchemy import select
            from app.models.skill import Skill
            from uuid import UUID

            factory = self._db_session_factory or async_session_factory
            async with factory() as db:
                result = await db.execute(
                    select(Skill).where(Skill.id == UUID(skill_id))
                )
                skill = result.scalar_one_or_none()
                if skill is None:
                    return None
                return {
                    "id": str(skill.id),
                    "name": skill.name,
                    "display_name": skill.display_name,
                    "category": skill.category,
                    "description": skill.description,
                    "version": skill.version,
                    "image": skill.image,
                    "entrypoint": skill.entrypoint,
                    "parameters": skill.parameters,
                    "input_schema": skill.input_schema,
                    "timeout": skill.timeout,
                    "max_memory_mb": skill.max_memory_mb,
                    "max_cpu": skill.max_cpu,
                    "environment_vars": skill.environment_vars,
                    "tags": skill.tags,
                }
        except Exception as exc:
            logger.warning(f"Failed to get skill {skill_id}: {exc}")
            return None

    async def execute_skill(self, skill_id: str, params: dict) -> dict:
        skill = await self.get_skill(skill_id)
        if skill is None:
            return {"success": False, "error": f"Skill {skill_id} not found"}

        try:
            from app.services.skill_executor import DockerSkillService

            executor = DockerSkillService()
            result = await executor.execute_skill(
                image=skill["image"],
                entrypoint=skill["entrypoint"],
                parameters=params,
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
        except Exception as exc:
            logger.error(f"Failed to execute skill {skill_id}: {exc}")
            return {"success": False, "error": str(exc)}


class Orchestrator:
    """Main orchestrator for the VulnFlow multi-agent system.

    Usage:
        orchestrator = Orchestrator(agent_config, skill_registry)
        async for event in orchestrator.stream(initial_state):
            # Send event to SSE client
            yield event
    """

    def __init__(
        self,
        agent_config: dict,
        skill_registry: Optional[SkillRegistry] = None,
    ) -> None:
        self.agent_config = agent_config
        self.skill_registry = skill_registry or SkillRegistry()

        # Create LLM provider
        self.llm_provider = LLMProviderFactory.create_from_agent_config(agent_config)
        self.llm = self.llm_provider.get_chat_model()

        # Get prompts for each agent
        prompts = SYSTEM_PROMPTS

        # Initialize agents
        self.planner = PlannerAgent(
            llm=self.llm,
            prompts=prompts.get("planner", {}),
            skill_registry=self.skill_registry,
        )
        self.executor = ExecutorAgent(
            llm=self.llm,
            prompts=prompts.get("executor", {}),
            skill_registry=self.skill_registry,
        )
        self.analyzer = AnalyzerAgent(
            llm=self.llm,
            prompts=prompts.get("analyzer", {}),
        )
        self.evaluator = EvaluatorAgent(
            llm=self.llm,
            prompts=prompts.get("evaluator", {}),
        )
        self.reporter = ReporterAgent(
            llm=self.llm,
            prompts=prompts.get("reporter", {}),
        )

        # Build the LangGraph workflow
        self.workflow = build_workflow()

    async def stream(
        self,
        state: dict[str, Any],
    ) -> AsyncGenerator[dict[str, Any], None]:
        """Execute the workflow and yield SSE-compatible events.

        Yields events in a format compatible with the chat SSE endpoint:
            - agent_message: Agent status messages
            - tool_call: Tool invocation events
            - tool_result: Tool execution results
            - skill_execution: Skill execution events
            - finding: New vulnerability finding
            - workflow_generated: Workflow DAG generated
            - progress: Progress updates
            - done: Workflow complete

        Args:
            state: Initial state dict with at minimum:
                - target_url: str
                - target_description: str
                - project_id: Optional[str]
                - task_id: Optional[str]
                - session_id: Optional[str]
                - mode: str ("auto", "semi", "review")
                - max_iterations: int

        Yields:
            Dict events for SSE streaming
        """
        # Build initial AgentState
        initial_state = self._build_initial_state(state)

        yield {
            "type": "agent_message",
            "content": "VulnFlow 多智能体渗透测试系统已启动",
            "agent": "system",
            "timestamp": time.time(),
            "metadata": {
                "provider": self.llm_provider.get_model_name(),
                "mode": state.get("mode", "auto"),
                "target": state.get("target_url", ""),
            },
        }

        try:
            async for chunk in self.workflow.astream(
                initial_state,
                config={"recursion_limit": state.get("max_iterations", 5) * 10},
            ):
                for node_name, node_output in chunk.items():
                    # Emit agent-specific events
                    await self._emit_node_events(node_name, node_output)

                    # Emit status messages
                    status_messages = node_output.get("status_messages", [])
                    for msg in status_messages:
                        yield msg

                    # Emit findings as they are discovered
                    findings = node_output.get("findings", [])
                    for finding in findings:
                        yield {
                            "type": "finding",
                            "content": json.dumps(finding, ensure_ascii=False),
                            "agent": node_name,
                            "timestamp": time.time(),
                            "metadata": {"severity": finding.get("severity", "info")},
                        }

                    # Emit progress update
                    yield {
                        "type": "progress",
                        "content": f"节点 {node_name} 完成",
                        "agent": node_name,
                        "timestamp": time.time(),
                        "metadata": {"node": node_name},
                    }

        except Exception as exc:
            logger.exception("workflow_stream_error")
            yield {
                "type": "error",
                "content": f"工作流执行失败: {str(exc)}",
                "timestamp": time.time(),
                "metadata": {"error_type": type(exc).__name__},
            }
            # Still try to generate a report with errors
            try:
                error_state = self._build_error_state(state, str(exc))
                report_result = await self.reporter.run(error_state)
                yield {
                    "type": "report",
                    "content": json.dumps(
                        report_result.get("report_data", {}), ensure_ascii=False
                    ),
                    "timestamp": time.time(),
                    "metadata": {"error": True},
                }
            except Exception as report_exc:
                logger.exception("error_report_failed")

        yield {
            "type": "done",
            "content": "渗透测试工作流已完成",
            "timestamp": time.time(),
            "metadata": {"status": "completed"},
        }

    async def invoke(self, state: dict[str, Any]) -> dict[str, Any]:
        """Execute the workflow synchronously and return the final state.

        Args:
            state: Initial state dict

        Returns:
            Final AgentState dict
        """
        initial_state = self._build_initial_state(state)

        try:
            final_state = await self.workflow.ainvoke(
                initial_state,
                config={"recursion_limit": state.get("max_iterations", 5) * 10},
            )
            return final_state
        except Exception as exc:
            logger.exception("workflow_invoke_error")
            error_state = self._build_error_state(state, str(exc))
            try:
                report_result = await self.reporter.run(error_state)
                error_state.update(report_result)
            except Exception:
                pass
            return error_state

    async def _emit_node_events(
        self, node_name: str, node_output: dict[str, Any]
    ) -> None:
        """Emit node-specific events for streaming (internal use)."""
        # Events are yielded from stream() directly
        pass

    def _build_initial_state(self, state: dict[str, Any]) -> AgentState:
        """Build the initial AgentState from user-provided state."""
        return {
            "messages": [],
            "target_url": state.get("target_url", ""),
            "target_description": state.get("target_description", ""),
            "project_id": state.get("project_id"),
            "task_id": state.get("task_id", str(uuid.uuid4())),
            "session_id": state.get("session_id"),
            "attack_plan": {},
            "selected_skills": [],
            "workflow_dag": {},
            "execution_results": {},
            "current_step": "初始化",
            "tool_calls": [],
            "findings": [],
            "evidence": [],
            "sensitive_clues": [],
            "risk_score": 0.0,
            "severity_distribution": {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0},
            "should_continue": True,
            "next_action": "开始规划",
            "report_data": {},
            "report_id": None,
            "error": "",
            "iteration": 0,
            "max_iterations": state.get("max_iterations", 5),
            "mode": state.get("mode", "auto"),
            "status_messages": [],
            # Store agent references in state for nodes to access
            "_planner_agent": self.planner,
            "_executor_agent": self.executor,
            "_analyzer_agent": self.analyzer,
            "_evaluator_agent": self.evaluator,
            "_reporter_agent": self.reporter,
        }

    def _build_error_state(self, state: dict[str, Any], error_msg: str) -> dict[str, Any]:
        """Build a state dict for error handling."""
        initial = self._build_initial_state(state)
        return {
            **initial,
            "error": error_msg,
            "status_messages": [
                {
                    "type": "error",
                    "content": error_msg,
                    "timestamp": time.time(),
                }
            ],
        }
