"""Planner Agent - attack path planning, skill selection, step decomposition."""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage

from app.ai.agents.base import BaseAgent

logger = logging.getLogger(__name__)

# Default Chinese system prompt for the planner
DEFAULT_PLANNER_SYSTEM_PROMPT = """你是一名专业的渗透测试规划专家。你的职责是：
1. 分析目标系统的描述，理解其技术栈和潜在攻击面
2. 根据渗透测试方法论（信息收集 -> 漏洞扫描 -> 漏洞利用 -> 后渗透 -> 报告），制定攻击计划
3. 选择合适的技能（Skills）来执行每个阶段
4. 构建工作流 DAG（有向无环图）结构

请以 JSON 格式返回攻击计划：
{
    "phases": [
        {
            "name": "阶段名称",
            "description": "阶段描述",
            "skills": ["skill_id_1", "skill_id_2"],
            "parallel": true/false,
            "depends_on": []
        }
    ],
    "methodology": "使用的渗透测试方法论",
    "estimated_time": "预估时间（分钟）",
    "risk_notes": "风险提示"
}

注意：
- 优先使用信息收集阶段的技能
- 后续阶段的技能应依赖前一阶段的结果
- 标记可以并行执行的技能
- 考虑目标的类型（Web应用、API、网络等）选择合适的技能
"""


class PlannerAgent(BaseAgent):
    """Planner Agent for attack path planning.

    On iteration 0: creates the initial attack plan
    On subsequent iterations: refines the plan based on new findings
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
        iteration = state.get("iteration", 0)

        if iteration == 0:
            return await self._create_initial_plan(state)
        else:
            return await self._refine_plan(state)

    async def _create_initial_plan(self, state: dict[str, Any]) -> dict[str, Any]:
        """Create the initial attack plan based on target description."""
        target_url = state.get("target_url", "")
        target_description = state.get("target_description", "")

        self._log(f"Creating initial plan for: {target_url}")

        # Get available skills for context
        available_skills = await self._get_available_skills()
        skills_context = self._format_skills_context(available_skills)

        system_prompt = self.prompts.get(
            "system", DEFAULT_PLANNER_SYSTEM_PROMPT
        )

        user_message = f"""目标信息：
- URL: {target_url}
- 描述: {target_description}

可用技能列表：
{skills_context}

请基于以上信息制定初始攻击计划。请用 JSON 格式返回。"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_message),
        ]

        try:
            response = await self.llm.ainvoke(messages)
            plan = self._parse_plan_response(response.content)
        except Exception as exc:
            self._log(f"LLM call failed, using default plan: {exc}", "warning")
            status_messages = self._add_status(state, f"[回退] AI 模型调用失败({exc})，使用默认渗透测试计划")
            state["status_messages"] = state.get("status_messages", []) + status_messages
            plan = self._default_plan()

        # Select initial skills from plan
        selected_skills = self._extract_skills_from_plan(plan)

        # Generate workflow DAG
        workflow_dag = self._build_workflow_dag(plan)

        status_messages = self._add_status(state, "攻击计划已制定完成")

        return {
            "attack_plan": {
                "phases": plan.get("phases", []),
                "current_phase": 0,
                "methodology": plan.get("methodology", "标准渗透测试方法论"),
            },
            "selected_skills": selected_skills,
            "workflow_dag": workflow_dag,
            "current_step": f"阶段 1: {plan.get('phases', [{}])[0].get('name', '信息收集')}",
            "iteration": state.get("iteration", 0) + 1,
            "status_messages": status_messages,
        }

    async def _refine_plan(self, state: dict[str, Any]) -> dict[str, Any]:
        """Refine the attack plan based on findings from previous iteration."""
        findings = state.get("findings", [])
        execution_results = state.get("execution_results", {})
        current_plan = state.get("attack_plan", {})
        current_phase = current_plan.get("current_phase", 0)
        phases = current_plan.get("phases", [])

        self._log(f"Refining plan, phase {current_phase}/{len(phases)}")

        # Move to next phase
        next_phase = current_phase + 1

        if next_phase >= len(phases):
            # All phases complete, no more planning needed
            return {
                "attack_plan": {**current_plan, "current_phase": next_phase},
                "current_step": "所有阶段已完成",
                "iteration": state.get("iteration", 0) + 1,
            }

        # Select skills for next phase
        next_phase_skills = phases[next_phase].get("skills", [])

        # Build DAG for remaining phases
        remaining_phases = phases[next_phase:]
        workflow_dag = self._build_workflow_dag({"phases": remaining_phases})

        status_messages = self._add_status(
            state,
            f"计划已更新，进入阶段 {next_phase + 1}: {phases[next_phase].get('name', '未知')}",
        )

        return {
            "attack_plan": {**current_plan, "current_phase": next_phase},
            "selected_skills": next_phase_skills,
            "workflow_dag": workflow_dag,
            "current_step": f"阶段 {next_phase + 1}: {phases[next_phase].get('name', '未知')}",
            "iteration": state.get("iteration", 0) + 1,
            "status_messages": status_messages,
        }

    async def _get_available_skills(self) -> list[dict]:
        """Get list of available skills from the skill registry."""
        if self.skill_registry is None:
            return []
        try:
            skills = await self.skill_registry.list_skills()
            return skills
        except Exception as exc:
            self._log(f"Failed to get skills: {exc}", "warning")
            return []

    def _format_skills_context(self, skills: list[dict]) -> str:
        """Format skills list for the LLM prompt."""
        if not skills:
            return "（无可用技能）"

        lines = []
        for skill in skills:
            skill_id = skill.get("id", skill.get("skill_id", "unknown"))
            name = skill.get("display_name", skill.get("name", "unknown"))
            category = skill.get("category", "general")
            description = skill.get("description", "无描述")
            lines.append(f"- [{category}] {name} (ID: {skill_id}): {description}")

        return "\n".join(lines)

    def _parse_plan_response(self, content: str) -> dict:
        """Parse LLM response into a plan dictionary."""
        try:
            # Try to extract JSON from the response
            content = str(content).strip()
            # Handle markdown code blocks
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            return json.loads(content)
        except (json.JSONDecodeError, IndexError):
            self._log("Failed to parse plan JSON, using default", "warning")
            state["status_messages"] = state.get("status_messages", []) + self._add_status(state, "[回退] AI 返回格式无法解析，使用默认计划")
            return self._default_plan()

    def _default_plan(self) -> dict:
        """Return a default penetration testing plan."""
        return {
            "phases": [
                {
                    "name": "信息收集",
                    "description": "收集目标的基本信息，包括子域名、端口、服务版本等",
                    "skills": [],
                    "parallel": True,
                    "depends_on": [],
                },
                {
                    "name": "漏洞扫描",
                    "description": "对发现的服务进行漏洞扫描和识别",
                    "skills": [],
                    "parallel": True,
                    "depends_on": ["信息收集"],
                },
                {
                    "name": "漏洞利用",
                    "description": "对确认的漏洞进行利用验证",
                    "skills": [],
                    "parallel": False,
                    "depends_on": ["漏洞扫描"],
                },
                {
                    "name": "报告生成",
                    "description": "汇总所有发现并生成渗透测试报告",
                    "skills": [],
                    "parallel": False,
                    "depends_on": ["漏洞利用"],
                },
            ],
            "methodology": "PTES (Penetration Testing Execution Standard)",
        }

    def _extract_skills_from_plan(self, plan: dict) -> list[str]:
        """Extract all skill IDs from the plan phases."""
        skills = []
        for phase in plan.get("phases", []):
            for skill in phase.get("skills", []):
                if skill not in skills:
                    skills.append(skill)
        return skills

    def _build_workflow_dag(self, plan: dict) -> dict:
        """Build a workflow DAG structure from the plan."""
        nodes = []
        edges = []
        node_id = 0

        for phase in plan.get("phases", []):
            phase_name = phase.get("name", f"Phase {node_id}")
            node_id += 1
            nodes.append({
                "id": str(node_id),
                "label": phase_name,
                "type": "phase",
                "skills": phase.get("skills", []),
                "parallel": phase.get("parallel", False),
            })

        # Create edges between sequential phases
        for i in range(len(nodes) - 1):
            edges.append({
                "source": nodes[i]["id"],
                "target": nodes[i + 1]["id"],
            })

        return {"nodes": nodes, "edges": edges}
