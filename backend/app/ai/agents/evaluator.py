"""Evaluator Agent - result evaluation, risk assessment, next-step decision."""

from __future__ import annotations

import logging
import time
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage

from app.ai.agents.base import BaseAgent

logger = logging.getLogger(__name__)

DEFAULT_EVALUATOR_SYSTEM_PROMPT = """你是一名渗透测试评估专家。你的职责是：
1. 评估已发现的漏洞，计算整体风险评分（0-100）
2. 统计严重性分布（critical, high, medium, low, info）
3. 判断是否需要继续测试（should_continue）
4. 建议下一步操作

评估标准：
- 发现 critical 漏洞：风险评分 >= 80
- 发现 high 漏洞：风险评分 >= 60
- 发现 medium 漏洞：风险评分 >= 40
- 仅 low/info：风险评分 < 40

继续测试的条件：
- 信息收集阶段未完成
- 存在可疑但未确认的漏洞
- 尚未完成所有计划阶段
- 风险评分较低但攻击面尚未完全覆盖

请以 JSON 格式返回评估结果：
{
    "risk_score": 0-100,
    "severity_distribution": {
        "critical": 0,
        "high": 0,
        "medium": 0,
        "low": 0,
        "info": 0
    },
    "should_continue": true/false,
    "next_action": "描述下一步操作",
    "summary": "评估摘要"
}
"""

# Severity weight for risk scoring
SEVERITY_WEIGHTS = {
    "critical": 25,
    "high": 15,
    "medium": 8,
    "low": 3,
    "info": 1,
}


class EvaluatorAgent(BaseAgent):
    """Evaluator Agent for risk assessment and next-step decision.

    Evaluates findings to compute overall risk score, severity distribution,
    and determines if more iterations are needed.
    """

    def __init__(
        self,
        llm: BaseChatModel,
        tools: list[Any] | None = None,
        prompts: dict[str, str] | None = None,
    ) -> None:
        super().__init__(llm, tools, prompts)

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        findings = state.get("findings", [])
        evidence = state.get("evidence", [])
        sensitive_clues = state.get("sensitive_clues", [])
        attack_plan = state.get("attack_plan", {})
        iteration = state.get("iteration", 0)
        max_iterations = state.get("max_iterations", 5)
        mode = state.get("mode", "auto")

        self._log(
            f"Evaluating: {len(findings)} findings, "
            f"{len(evidence)} evidence, {len(sensitive_clues)} clues"
        )

        # Compute severity distribution
        severity_dist = self._compute_severity_distribution(findings)

        # Compute risk score using weighted formula
        risk_score = self._compute_risk_score(severity_dist)

        # Determine if we should continue
        should_continue = self._should_continue(
            state, severity_dist, risk_score, iteration, max_iterations
        )

        # Determine next action
        next_action = self._determine_next_action(state, should_continue)

        # Use LLM for deeper evaluation
        try:
            llm_eval = await self._llm_evaluate(state, findings, severity_dist, risk_score)
            if llm_eval:
                risk_score = llm_eval.get("risk_score", risk_score)
                should_continue = llm_eval.get("should_continue", should_continue)
                next_action = llm_eval.get("next_action", next_action)
        except Exception as exc:
            self._log(f"LLM evaluation failed, using heuristic: {exc}", "warning")

        status_messages = self._add_status(
            state,
            f"风险评估完成 - 评分: {risk_score}/100, "
            f"严重性分布: {severity_dist}, "
            f"{'继续测试' if should_continue else '完成测试'}",
        )

        return {
            "risk_score": risk_score,
            "severity_distribution": severity_dist,
            "should_continue": should_continue,
            "next_action": next_action,
            "status_messages": status_messages,
        }

    def _compute_severity_distribution(self, findings: list[dict]) -> dict[str, int]:
        """Count findings by severity level."""
        dist = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        for finding in findings:
            severity = finding.get("severity", "info").lower()
            if severity in dist:
                dist[severity] += 1
        return dist

    def _compute_risk_score(self, severity_dist: dict[str, int]) -> float:
        """Compute overall risk score using weighted formula.

        Formula: sum(severity_count * weight) capped at 100.
        """
        raw_score = sum(
            severity_dist.get(level, 0) * weight
            for level, weight in SEVERITY_WEIGHTS.items()
        )
        return min(raw_score, 100.0)

    def _should_continue(
        self,
        state: dict[str, Any],
        severity_dist: dict[str, int],
        risk_score: float,
        iteration: int,
        max_iterations: int,
    ) -> bool:
        """Determine whether to continue with another iteration."""
        # Hard stop at max iterations
        if iteration >= max_iterations:
            return False

        # Continue if we haven't found anything yet
        total_findings = sum(severity_dist.values())
        if total_findings == 0 and iteration < 2:
            return True

        # Continue if we have critical/high findings and haven't explored fully
        if severity_dist.get("critical", 0) > 0 or severity_dist.get("high", 0) > 0:
            plan = state.get("attack_plan", {})
            current_phase = plan.get("current_phase", 0)
            total_phases = len(plan.get("phases", []))
            if current_phase < total_phases - 1:
                return True

        # Stop if risk is low and we've done at least one iteration
        if risk_score < 30 and iteration >= 1:
            return False

        # Default: continue if there are more phases
        plan = state.get("attack_plan", {})
        current_phase = plan.get("current_phase", 0)
        total_phases = len(plan.get("phases", []))
        return current_phase < total_phases - 1

    def _determine_next_action(
        self, state: dict[str, Any], should_continue: bool
    ) -> str:
        """Determine the recommended next action."""
        if not should_continue:
            return "report"

        plan = state.get("attack_plan", {})
        current_phase = plan.get("current_phase", 0)
        phases = plan.get("phases", [])
        if current_phase < len(phases):
            next_phase_name = phases[current_phase].get("name", "下一阶段")
            return f"继续执行: {next_phase_name}"

        return "report"

    async def _llm_evaluate(
        self,
        state: dict[str, Any],
        findings: list[dict],
        severity_dist: dict[str, int],
        risk_score: float,
    ) -> dict | None:
        """Use LLM for deeper evaluation."""
        system_prompt = self.prompts.get(
            "system", DEFAULT_EVALUATOR_SYSTEM_PROMPT
        )

        # Summarize findings for the LLM
        findings_summary = self._summarize_findings(findings)

        user_message = f"""请评估以下渗透测试结果：

风险评分（算法计算）: {risk_score}/100
严重性分布: {severity_dist}
当前迭代: {state.get('iteration', 0)}/{state.get('max_iterations', 5)}
模式: {state.get('mode', 'auto')}

发现摘要:
{findings_summary}

请以 JSON 格式返回评估结果。"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_message),
        ]

        response = await self.llm.ainvoke(messages)

        import json
        try:
            content = str(response.content).strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            return json.loads(content)
        except (json.JSONDecodeError, IndexError):
            return None

    def _summarize_findings(self, findings: list[dict]) -> str:
        """Create a summary of findings for the LLM prompt."""
        if not findings:
            return "（无发现）"

        lines = []
        for i, finding in enumerate(findings[:10], 1):
            lines.append(
                f"{i}. [{finding.get('severity', 'info').upper()}] "
                f"{finding.get('title', '未知')} "
                f"(置信度: {finding.get('confidence', 0):.0%})"
            )
        if len(findings) > 10:
            lines.append(f"... 以及其他 {len(findings) - 10} 个发现")
        return "\n".join(lines)
