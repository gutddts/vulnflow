"""Reporter Agent - report generation with MITRE ATT&CK mapping."""

from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage

from app.ai.agents.base import BaseAgent

logger = logging.getLogger(__name__)

DEFAULT_REPORTER_SYSTEM_PROMPT = """你是一名渗透测试报告生成专家。你的职责是：
1. 汇总所有发现（findings）、证据（evidence）和敏感线索（sensitive_clues）
2. 生成结构化的渗透测试报告
3. 映射到 MITRE ATT&CK 框架
4. 生成执行摘要

报告应包含以下部分：
1. 执行摘要（Executive Summary）
2. 测试范围和方法
3. 漏洞详情（按严重性排序）
4. 证据清单
5. 敏感信息泄露
6. MITRE ATT&CK 映射
7. 修复建议
8. 风险评估总结

请以 JSON 格式返回报告结构：
{
    "executive_summary": "执行摘要",
    "scope": {"target": "目标", "methodology": "方法论", "duration": "时长"},
    "findings_summary": {"total": 总数, "by_severity": {}},
    "detailed_findings": [...],
    "evidence_list": [...],
    "sensitive_data_findings": [...],
    "mitre_attack_mapping": [...],
    "remediation_plan": [...],
    "risk_summary": "风险评估总结"
}
"""

# MITRE ATT&CK technique mapping for common vulnerabilities
MITRE_MAPPING = {
    "CWE-89": {"tactic": "Initial Access", "technique": "T1190", "name": "Exploit Public-Facing Application"},
    "CWE-79": {"tactic": "Execution", "technique": "T1059", "name": "Command and Scripting Interpreter"},
    "CWE-78": {"tactic": "Execution", "technique": "T1059", "name": "Command and Scripting Interpreter"},
    "CWE-22": {"tactic": "Collection", "technique": "T1005", "name": "Data from Local System"},
    "CWE-918": {"tactic": "Initial Access", "technique": "T1190", "name": "Exploit Public-Facing Application"},
    "CWE-502": {"tactic": "Execution", "technique": "T1203", "name": "Exploitation for Client Execution"},
    "CWE-200": {"tactic": "Collection", "technique": "T1530", "name": "Data from Cloud Storage"},
    "CWE-521": {"tactic": "Credential Access", "technique": "T1110", "name": "Brute Force"},
    "CWE-639": {"tactic": "Collection", "technique": "T1530", "name": "Data from Cloud Storage"},
    "CWE-611": {"tactic": "Initial Access", "technique": "T1190", "name": "Exploit Public-Facing Application"},
}

# Chinese severity labels
SEVERITY_LABELS = {
    "critical": "严重",
    "high": "高危",
    "medium": "中危",
    "low": "低危",
    "info": "信息",
}


class ReporterAgent(BaseAgent):
    """Reporter Agent for generating penetration testing reports.

    Aggregates all findings, evidence, and execution data into a structured
    report with executive summary and MITRE ATT&CK mapping.
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
        execution_results = state.get("execution_results", {})
        attack_plan = state.get("attack_plan", {})
        risk_score = state.get("risk_score", 0)
        severity_dist = state.get("severity_distribution", {})
        target_url = state.get("target_url", "")
        target_description = state.get("target_description", "")

        self._log(f"Generating report with {len(findings)} findings")

        # Build report data
        report_data = {
            "report_id": str(uuid.uuid4()),
            "generated_at": time.time(),
            "executive_summary": "",
            "scope": {
                "target": target_url,
                "description": target_description,
                "methodology": attack_plan.get("methodology", "PTES"),
                "phases_executed": len(attack_plan.get("phases", [])),
                "skills_executed": len(execution_results),
            },
            "findings_summary": {
                "total": len(findings),
                "by_severity": severity_dist,
                "risk_score": risk_score,
            },
            "detailed_findings": self._sort_findings_by_severity(findings),
            "evidence_list": evidence,
            "sensitive_data_findings": sensitive_clues,
            "mitre_attack_mapping": self._build_mitre_mapping(findings),
            "remediation_plan": self._build_remediation_plan(findings),
            "risk_summary": "",
        }

        # Generate executive summary via LLM
        try:
            summary = await self._generate_executive_summary(state, report_data)
            report_data["executive_summary"] = summary
        except Exception as exc:
            self._log(f"LLM summary generation failed: {exc}", "warning")
            report_data["executive_summary"] = self._default_summary(report_data)
            state["status_messages"] = state.get("status_messages", []) + self._add_status(state, "[回退] AI 报告摘要生成失败，使用默认模板")

        # Generate risk summary
        report_data["risk_summary"] = self._generate_risk_summary(report_data)

        # Sort findings by severity
        status_messages = self._add_status(state, "渗透测试报告已生成")

        return {
            "report_data": report_data,
            "report_id": report_data["report_id"],
            "status_messages": status_messages,
        }

    def _sort_findings_by_severity(self, findings: list[dict]) -> list[dict]:
        """Sort findings by severity (critical first)."""
        severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
        return sorted(
            findings,
            key=lambda f: severity_order.get(f.get("severity", "info").lower(), 5),
        )

    def _build_mitre_mapping(self, findings: list[dict]) -> list[dict]:
        """Build MITRE ATT&CK mapping for findings."""
        mapping = []
        seen_techniques = set()

        for finding in findings:
            cwe_id = finding.get("cwe_id", "")
            if cwe_id in MITRE_MAPPING and cwe_id not in seen_techniques:
                seen_techniques.add(cwe_id)
                mitre = MITRE_MAPPING[cwe_id]
                mapping.append({
                    "tactic": mitre["tactic"],
                    "technique_id": mitre["technique"],
                    "technique_name": mitre["name"],
                    "cwe_id": cwe_id,
                    "vulnerability": finding.get("title", ""),
                    "severity": finding.get("severity", "info"),
                })

        return mapping

    def _build_remediation_plan(self, findings: list[dict]) -> list[dict]:
        """Build a prioritized remediation plan."""
        sorted_findings = self._sort_findings_by_severity(findings)
        plan = []

        for i, finding in enumerate(sorted_findings[:20], 1):
            plan.append({
                "priority": i,
                "title": finding.get("title", ""),
                "severity": finding.get("severity", ""),
                "remediation": finding.get("remediation", "请根据具体情况制定修复方案"),
                "affected_host": finding.get("affected_host", ""),
                "affected_service": finding.get("affected_service", ""),
            })

        return plan

    async def _generate_executive_summary(
        self, state: dict[str, Any], report_data: dict
    ) -> str:
        """Generate executive summary using LLM."""
        system_prompt = self.prompts.get(
            "system", DEFAULT_REPORTER_SYSTEM_PROMPT
        )

        # Build a compact summary for the LLM
        findings_summary = self._build_findings_text(report_data["detailed_findings"])

        user_message = f"""请生成一份渗透测试执行摘要。

目标: {report_data['scope']['target']}
描述: {report_data['scope']['description']}
方法论: {report_data['scope']['methodology']}
发现总数: {report_data['findings_summary']['total']}
风险评分: {report_data['findings_summary']['risk_score']}/100
严重性分布: {report_data['findings_summary']['by_severity']}

主要发现:
{findings_summary}

请生成一段简洁的执行摘要（中文，300-500字）。"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_message),
        ]

        response = await self.llm.ainvoke(messages)
        return str(response.content).strip()

    def _build_findings_text(self, findings: list[dict]) -> str:
        """Build text summary of findings for LLM prompt."""
        if not findings:
            return "（无发现）"

        lines = []
        for i, finding in enumerate(findings[:10], 1):
            severity_label = SEVERITY_LABELS.get(
                finding.get("severity", "info"), "信息"
            )
            lines.append(
                f"{i}. [{severity_label}] {finding.get('title', '未知')}"
            )
            desc = finding.get("description", "")
            if desc:
                lines.append(f"   {desc[:150]}")

        if len(findings) > 10:
            lines.append(f"... 以及其他 {len(findings) - 10} 个发现")
        return "\n".join(lines)

    def _default_summary(self, report_data: dict) -> str:
        """Generate a default executive summary without LLM."""
        total = report_data["findings_summary"]["total"]
        risk = report_data["findings_summary"]["risk_score"]
        dist = report_data["findings_summary"]["by_severity"]

        critical_count = dist.get("critical", 0)
        high_count = dist.get("high", 0)

        return (
            f"本次渗透测试针对目标 {report_data['scope']['target']} 进行，"
            f"采用 {report_data['scope']['methodology']} 方法论，"
            f"共发现 {total} 个安全问题。"
            f"其中严重漏洞 {critical_count} 个，高危漏洞 {high_count} 个。"
            f"综合风险评分为 {risk}/100。"
            f"建议优先修复严重和高危漏洞，并进行全面安全加固。"
        )

    def _generate_risk_summary(self, report_data: dict) -> str:
        """Generate risk summary text."""
        risk = report_data["findings_summary"]["risk_score"]
        dist = report_data["findings_summary"]["by_severity"]

        if risk >= 80:
            level = "严重风险 - 系统存在严重安全漏洞，可能导致完全控制"
        elif risk >= 60:
            level = "高风险 - 系统存在多个高危漏洞，需立即修复"
        elif risk >= 40:
            level = "中等风险 - 系统存在一些安全漏洞，建议及时修复"
        elif risk >= 20:
            level = "低风险 - 系统安全性较好，存在少量低危问题"
        else:
            level = "信息安全 - 系统安全性良好，仅发现信息级问题"

        parts = [level]
        for sev, label in [("critical", "严重"), ("high", "高危"), ("medium", "中危"), ("low", "低危"), ("info", "信息")]:
            count = dist.get(sev, 0)
            if count > 0:
                parts.append(f"{label}: {count}个")

        return "，".join(parts)
