"""LangGraph node functions for the VulnFlow multi-agent system.

Each node:
    1. Receives the current AgentState
    2. Calls its corresponding agent
    3. Appends status_messages for streaming
    4. Returns updated state
"""

from __future__ import annotations

import logging
import time
from typing import Any

from app.ai.graph.state import AgentState

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------ #
#  Planner Node
# ------------------------------------------------------------------ #
async def planner_node(state: AgentState) -> dict[str, Any]:
    """Planner node: creates attack plan, selects skills, generates workflow DAG.

    Called at the start of each iteration. On the first call (iteration 0),
    it creates the initial plan. On subsequent calls, it refines the plan
    based on new findings.
    """
    from app.ai.agents.planner import PlannerAgent

    try:
        agent: PlannerAgent = state.get("_planner_agent")  # type: ignore[assignment]
        if agent is None:
            return _error_state(state, "Planner agent not initialized")

        status_messages = list(state.get("status_messages", []))
        status_messages.append({
            "type": "agent_message",
            "content": "正在分析目标并制定攻击计划...",
            "agent": "planner",
            "timestamp": time.time(),
        })

        result = await agent.run(state)

        status_messages.append({
            "type": "agent_message",
            "content": "攻击计划已生成",
            "agent": "planner",
            "timestamp": time.time(),
        })

        return {
            **result,
            "status_messages": status_messages,
            "error": "",
        }

    except Exception as exc:
        logger.exception("planner_node_failed")
        return _error_state(state, f"计划制定失败: {str(exc)}")


# ------------------------------------------------------------------ #
#  Executor Node
# ------------------------------------------------------------------ #
async def executor_node(state: AgentState) -> dict[str, Any]:
    """Executor node: executes selected skills via Celery tasks.

    Takes the attack plan and selected skills, creates Celery task signatures,
    monitors execution, and collects results.
    """
    from app.ai.agents.executor import ExecutorAgent

    try:
        agent: ExecutorAgent = state.get("_executor_agent")  # type: ignore[assignment]
        if agent is None:
            return _error_state(state, "Executor agent not initialized")

        status_messages = list(state.get("status_messages", []))
        plan = state.get("attack_plan", {})
        phase = plan.get("current_phase", 0)
        phases = plan.get("phases", [])
        phase_name = phases[phase]["name"] if phase < len(phases) else "unknown"

        status_messages.append({
            "type": "agent_message",
            "content": f"正在执行阶段 {phase + 1}/{len(phases)}: {phase_name}",
            "agent": "executor",
            "timestamp": time.time(),
        })

        result = await agent.run(state)

        status_messages.append({
            "type": "agent_message",
            "content": "技能执行完成",
            "agent": "executor",
            "timestamp": time.time(),
        })

        return {
            **result,
            "status_messages": status_messages,
            "error": "",
        }

    except Exception as exc:
        logger.exception("executor_node_failed")
        return _error_state(state, f"技能执行失败: {str(exc)}")


# ------------------------------------------------------------------ #
#  Analyzer Node
# ------------------------------------------------------------------ #
async def analyzer_node(state: AgentState) -> dict[str, Any]:
    """Analyzer node: parses results, identifies vulnerabilities, extracts evidence.

    Analyzes skill execution outputs to find vulnerabilities, extract
    evidence (URLs, payloads, screenshots), and update findings.
    """
    from app.ai.agents.analyzer import AnalyzerAgent

    try:
        agent: AnalyzerAgent = state.get("_analyzer_agent")  # type: ignore[assignment]
        if agent is None:
            return _error_state(state, "Analyzer agent not initialized")

        status_messages = list(state.get("status_messages", []))
        status_messages.append({
            "type": "agent_message",
            "content": "正在分析执行结果并识别漏洞...",
            "agent": "analyzer",
            "timestamp": time.time(),
        })

        result = await agent.run(state)

        findings_count = len(result.get("findings", []))
        status_messages.append({
            "type": "agent_message",
            "content": f"分析完成，发现 {findings_count} 个潜在漏洞",
            "agent": "analyzer",
            "timestamp": time.time(),
        })

        return {
            **result,
            "status_messages": status_messages,
            "error": "",
        }

    except Exception as exc:
        logger.exception("analyzer_node_failed")
        return _error_state(state, f"结果分析失败: {str(exc)}")


# ------------------------------------------------------------------ #
#  Evaluator Node
# ------------------------------------------------------------------ #
async def evaluator_node(state: AgentState) -> dict[str, Any]:
    """Evaluator node: assesses risk, decides whether to continue.

    Evaluates findings to compute overall risk score, severity distribution,
    and determines if more iterations are needed. Handles human-in-the-loop
    confirmation in semi/review modes.
    """
    from app.ai.agents.evaluator import EvaluatorAgent

    try:
        agent: EvaluatorAgent = state.get("_evaluator_agent")  # type: ignore[assignment]
        if agent is None:
            return _error_state(state, "Evaluator agent not initialized")

        status_messages = list(state.get("status_messages", []))
        status_messages.append({
            "type": "agent_message",
            "content": "正在评估风险并决定下一步...",
            "agent": "evaluator",
            "timestamp": time.time(),
        })

        result = await agent.run(state)

        should_continue = result.get("should_continue", False)
        risk = result.get("risk_score", 0)
        next_action = result.get("next_action", "report")

        msg = (
            f"评估完成 - 风险评分: {risk}/100, "
            f"{'继续测试' if should_continue else '生成报告'}"
        )
        status_messages.append({
            "type": "agent_message",
            "content": msg,
            "agent": "evaluator",
            "timestamp": time.time(),
        })

        return {
            **result,
            "status_messages": status_messages,
            "error": "",
        }

    except Exception as exc:
        logger.exception("evaluator_node_failed")
        return _error_state(state, f"风险评估失败: {str(exc)}")


# ------------------------------------------------------------------ #
#  Reporter Node
# ------------------------------------------------------------------ #
async def reporter_node(state: AgentState) -> dict[str, Any]:
    """Reporter node: aggregates findings and generates the final report.

    Compiles all findings, evidence, and execution data into a structured
    report with executive summary and MITRE ATT&CK mapping.
    """
    from app.ai.agents.reporter import ReporterAgent

    try:
        agent: ReporterAgent = state.get("_reporter_agent")  # type: ignore[assignment]
        if agent is None:
            return _error_state(state, "Reporter agent not initialized")

        status_messages = list(state.get("status_messages", []))
        status_messages.append({
            "type": "agent_message",
            "content": "正在生成渗透测试报告...",
            "agent": "reporter",
            "timestamp": time.time(),
        })

        result = await agent.run(state)

        status_messages.append({
            "type": "agent_message",
            "content": "报告生成完成",
            "agent": "reporter",
            "timestamp": time.time(),
        })

        return {
            **result,
            "status_messages": status_messages,
            "error": "",
        }

    except Exception as exc:
        logger.exception("reporter_node_failed")
        return _error_state(state, f"报告生成失败: {str(exc)}")


# ------------------------------------------------------------------ #
#  Helpers
# ------------------------------------------------------------------ #
def _error_state(state: AgentState, error_msg: str) -> dict[str, Any]:
    """Build an error state dict that preserves existing state fields."""
    status_messages = list(state.get("status_messages", []))
    status_messages.append({
        "type": "error",
        "content": error_msg,
        "timestamp": time.time(),
    })
    return {
        "error": error_msg,
        "status_messages": status_messages,
    }
