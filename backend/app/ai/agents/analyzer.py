"""Analyzer Agent - result parsing, vulnerability identification, evidence extraction."""

from __future__ import annotations

import json
import logging
import re
import time
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage

from app.ai.agents.base import BaseAgent

logger = logging.getLogger(__name__)

DEFAULT_ANALYZER_SYSTEM_PROMPT = """你是一名渗透测试结果分析专家。你的职责是：
1. 解析技能（Skill）执行输出，提取关键信息
2. 识别潜在的漏洞和安全问题
3. 提取证据（URL、Payload、截图路径等）
4. 识别敏感信息泄露（dongxuan 风格的线索系统）

对于每个发现，请以 JSON 格式返回：
{
    "findings": [
        {
            "title": "漏洞标题",
            "description": "详细描述",
            "severity": "critical/high/medium/low/info",
            "cwe_id": "CWE-xxx",
            "affected_host": "受影响主机",
            "affected_port": 端口号,
            "affected_service": "受影响服务",
            "evidence": "证据描述",
            "remediation": "修复建议",
            "confidence": 0.0-1.0
        }
    ],
    "evidence": [
        {
            "type": "url/payload/screenshot/log",
            "content": "证据内容",
            "source_skill": "来源技能ID"
        }
    ],
    "sensitive_clues": [
        {
            "type": "credential/api_key/config/token",
            "content": "发现内容",
            "location": "位置描述",
            "risk": "风险等级"
        }
    ]
}

注意：
- 严重性评估：critical（可直接获取系统权限）、high（可获取敏感数据）、medium（有限影响）、low（信息泄露）、info（提示信息）
- 使用 CWE 标准编号
- 标记置信度以帮助评估
"""

# Regex patterns for common vulnerability indicators
VULN_PATTERNS = [
    (r"(?i)sql\s*(injection|注入|error)", "CWE-89", "high", "SQL注入漏洞"),
    (r"(?i)xss|cross.?site.?scripting|跨站脚本", "CWE-79", "medium", "XSS跨站脚本漏洞"),
    (r"(?i)(command|命令)\s*(injection|注入|execution)", "CWE-78", "high", "命令注入漏洞"),
    (r"(?i)path\s*traversal|目录遍历|\.\./", "CWE-22", "high", "路径遍历漏洞"),
    (r"(?i)(open|未授权|unauthorized)\s*(redirect|重定向)", "CWE-601", "medium", "开放重定向漏洞"),
    (r"(?i)ssrf|server.?side.?request.?forgery", "CWE-918", "high", "SSRF漏洞"),
    (r"(?i)xxe|xml\s*external\s*entity", "CWE-611", "high", "XXE漏洞"),
    (r"(?i)deserialization|反序列化", "CWE-502", "high", "反序列化漏洞"),
    (r"(?i)idor|insecure\s*direct\s*object\s*reference", "CWE-639", "high", "IDOR漏洞"),
    (r"(?i)sensitive\s*(data|information)\s*exposure|敏感信息泄露", "CWE-200", "medium", "敏感信息泄露"),
    (r"(?i)(default|弱|weak)\s*(password|密码|credential)", "CWE-521", "high", "弱密码/默认凭证"),
    (r"(?i)open\s*port|端口.*开放|服务.*运行", None, "info", "开放端口/服务"),
    (r"(?i)outdated|过时|version.*old|deprecated", "CWE-1104", "low", "过时版本"),
    (r"(?i)misconfiguration|配置错误|错误配置", "CWE-16", "medium", "配置错误"),
]

# Patterns for sensitive data detection (dongxuan-style clues)
SENSITIVE_PATTERNS = [
    (r"(?i)(api[_-]?key|api[_-]?secret|access[_-]?key)\s*[:=]\s*['\"]?\w+", "api_key", "API密钥"),
    (r"(?i)(password|passwd|pwd)\s*[:=]\s*['\"]?\S+", "credential", "密码凭证"),
    (r"(?i)(token|jwt|bearer)\s*[:=]\s*['\"]?[\w.-]+", "token", "认证令牌"),
    (r"(?i)(aws[_-]?access|aws[_-]?secret|AKIA[\w]{16})", "config", "AWS凭证"),
    (r"(?i)(ssh[_-]?key|private[_-]?key|-----BEGIN)", "credential", "SSH私钥"),
    (r"(?i)(database[_-]?url|connection[_-]?string|jdbc:|mongodb://)", "config", "数据库连接串"),
    (r"(?i)(\.git/|\.svn/|\.env|\.htaccess|wp-config)", "config", "敏感文件暴露"),
    (r"(?i)(internal[_-]?ip|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)", "config", "内网IP泄露"),
    (r"(?i)(secret[_-]?key|private[_-]?key|encryption[_-]?key)", "config", "加密密钥"),
]


class AnalyzerAgent(BaseAgent):
    """Analyzer Agent for result parsing and vulnerability identification.

    Parses skill execution outputs, identifies vulnerabilities,
    extracts evidence, and detects sensitive information leaks.
    """

    def __init__(
        self,
        llm: BaseChatModel,
        tools: list[Any] | None = None,
        prompts: dict[str, str] | None = None,
    ) -> None:
        super().__init__(llm, tools, prompts)

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        execution_results = state.get("execution_results", {})
        existing_findings = list(state.get("findings", []))
        existing_evidence = list(state.get("evidence", []))
        existing_clues = list(state.get("sensitive_clues", []))

        self._log(f"Analyzing {len(execution_results)} execution results")

        new_findings: list[dict] = []
        new_evidence: list[dict] = []
        new_clues: list[dict] = []

        for skill_id, result in execution_results.items():
            if not result:
                continue

            output = result.get("output", result.get("stdout", ""))
            if not output:
                continue

            # Pattern-based analysis (fast, no LLM call)
            pattern_findings = self._pattern_analysis(output, skill_id)
            pattern_evidence = self._extract_evidence_patterns(output, skill_id)
            pattern_clues = self._detect_sensitive_data(output, skill_id)

            new_findings.extend(pattern_findings)
            new_evidence.extend(pattern_evidence)
            new_clues.extend(pattern_clues)

            # LLM-based deep analysis for complex results
            if len(output) > 100 and result.get("success") is not False:
                try:
                    llm_findings, llm_evidence, llm_clues = await self._llm_analysis(
                        output, skill_id
                    )
                    new_findings.extend(llm_findings)
                    new_evidence.extend(llm_evidence)
                    new_clues.extend(llm_clues)
                except Exception as exc:
                    self._log(f"LLM analysis failed for {skill_id}: {exc}", "warning")
                    state["status_messages"] = state.get("status_messages", []) + self._add_status(state, f"[回退] AI 深度分析({skill_id})失败，仅使用模式匹配结果")

        # Deduplicate findings
        deduped_findings = self._deduplicate_findings(existing_findings + new_findings)

        all_findings = existing_findings + new_findings
        all_evidence = existing_evidence + new_evidence
        all_clues = existing_clues + new_clues

        status_messages = self._add_status(
            state,
            f"分析完成: 发现 {len(new_findings)} 个新漏洞, "
            f"{len(new_evidence)} 个证据, {len(new_clues)} 个敏感线索",
        )

        return {
            "findings": deduped_findings,
            "evidence": all_evidence,
            "sensitive_clues": all_clues,
            "status_messages": status_messages,
        }

    def _pattern_analysis(self, output: str, skill_id: str) -> list[dict]:
        """Fast pattern-based vulnerability detection."""
        findings = []
        seen_types = set()

        for pattern, cwe_id, severity, vuln_type in VULN_PATTERNS:
            matches = re.findall(pattern, output)
            if matches and vuln_type not in seen_types:
                seen_types.add(vuln_type)
                # Extract context around match
                context = self._extract_context(output, pattern)

                findings.append({
                    "title": vuln_type,
                    "description": f"通过模式匹配在技能 {skill_id} 的输出中检测到{vuln_type}迹象",
                    "severity": severity,
                    "cwe_id": cwe_id,
                    "affected_host": "",
                    "affected_port": None,
                    "affected_service": "",
                    "evidence": context[:500],
                    "remediation": self._get_remediation_suggestion(cwe_id or ""),
                    "confidence": 0.6,
                    "source_skill": skill_id,
                    "detection_method": "pattern",
                    "tags": [vuln_type],
                })

        return findings

    def _extract_context(self, text: str, pattern: str, context_chars: int = 200) -> str:
        """Extract surrounding context around a pattern match."""
        match = re.search(pattern, text)
        if not match:
            return ""
        start = max(0, match.start() - context_chars)
        end = min(len(text), match.end() + context_chars)
        return text[start:end]

    def _extract_evidence_patterns(self, output: str, skill_id: str) -> list[dict]:
        """Extract evidence items from output."""
        evidence = []

        # Extract URLs
        urls = re.findall(r'https?://[^\s<>"\'\)\]]+', output)
        for url in urls[:10]:  # Limit to 10 URLs
            evidence.append({
                "type": "url",
                "content": url,
                "source_skill": skill_id,
            })

        # Extract IP:port patterns
        ip_ports = re.findall(r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{1,5})', output)
        for ip, port in ip_ports[:5]:
            evidence.append({
                "type": "service",
                "content": f"{ip}:{port}",
                "source_skill": skill_id,
            })

        # Extract payload-like strings (common SQL/XSS patterns)
        payload_patterns = [
            r"(?i)(select\s+.+\s+from\s+.+)",
            r"(?i)(<script>.*?</script>)",
            r"(?i)(union\s+select)",
            r"(?i)(sleep\(\d+\))",
        ]
        for pp in payload_patterns:
            matches = re.findall(pp, output)
            for match in matches[:3]:
                evidence.append({
                    "type": "payload",
                    "content": match[:300],
                    "source_skill": skill_id,
                })

        return evidence

    def _detect_sensitive_data(self, output: str, skill_id: str) -> list[dict]:
        """Detect sensitive data in output (dongxuan-style clues)."""
        clues = []

        for pattern, clue_type, clue_name in SENSITIVE_PATTERNS:
            matches = re.findall(pattern, output)
            for match in matches[:5]:
                # Mask the sensitive value
                masked = self._mask_sensitive(match)
                clues.append({
                    "type": clue_type,
                    "content": masked,
                    "location": f"技能 {skill_id} 输出中",
                    "risk": "high" if clue_type in ("credential", "api_key") else "medium",
                    "source_skill": skill_id,
                    "clue_name": clue_name,
                })

        return clues

    def _mask_sensitive(self, text: str) -> str:
        """Mask sensitive data for safe storage."""
        if len(text) <= 8:
            return text[:2] + "***"
        return text[:4] + "***" + text[-4:]

    async def _llm_analysis(
        self, output: str, skill_id: str
    ) -> tuple[list[dict], list[dict], list[dict]]:
        """Use LLM for deep analysis of complex outputs."""
        system_prompt = self.prompts.get(
            "system", DEFAULT_ANALYZER_SYSTEM_PROMPT
        )

        # Truncate very long outputs
        truncated_output = output[:8000] if len(output) > 8000 else output

        user_message = f"""请分析以下技能执行输出，识别漏洞、提取证据和敏感线索。

技能ID: {skill_id}

输出内容:
```
{truncated_output}
```

请以 JSON 格式返回分析结果。"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_message),
        ]

        response = await self.llm.ainvoke(messages)
        parsed = self._parse_llm_response(response.content)

        findings = parsed.get("findings", [])
        evidence = parsed.get("evidence", [])
        clues = parsed.get("sensitive_clues", [])

        # Tag findings with source
        for f in findings:
            f["source_skill"] = skill_id
            f["detection_method"] = "llm"

        for e in evidence:
            e["source_skill"] = skill_id

        for c in clues:
            c["source_skill"] = skill_id

        return findings, evidence, clues

    def _parse_llm_response(self, content: str) -> dict:
        """Parse LLM JSON response."""
        try:
            content = str(content).strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            return json.loads(content)
        except (json.JSONDecodeError, IndexError):
            self._log("Failed to parse LLM analysis response", "warning")
            return {}

    def _deduplicate_findings(self, findings: list[dict]) -> list[dict]:
        """Deduplicate findings by title similarity."""
        seen = set()
        unique = []
        for finding in findings:
            key = finding.get("title", "").lower().strip()
            if key and key not in seen:
                seen.add(key)
                unique.append(finding)
            elif not key:
                unique.append(finding)
        return unique

    def _get_remediation_suggestion(self, cwe_id: str) -> str:
        """Get basic remediation suggestion by CWE ID."""
        suggestions = {
            "CWE-89": "使用参数化查询或预编译语句，对所有输入进行严格验证和过滤",
            "CWE-79": "对输出进行HTML实体编码，实施内容安全策略（CSP）",
            "CWE-78": "避免使用系统命令，如必须使用则对输入进行严格白名单验证",
            "CWE-22": "使用白名单验证文件路径，避免用户输入直接控制文件路径",
            "CWE-601": "验证重定向URL是否在白名单内，使用相对路径重定向",
            "CWE-918": "禁止用户控制请求URL，使用白名单限制可访问的内部资源",
            "CWE-611": "禁用XML外部实体解析（DTD），使用安全的XML解析器",
            "CWE-502": "避免反序列化不可信数据，使用数字签名验证序列化数据完整性",
            "CWE-639": "实施严格的访问控制，验证用户对资源的访问权限",
            "CWE-200": "确保敏感数据加密存储和传输，实施最小权限原则",
            "CWE-521": "实施强密码策略，禁用默认账户，启用多因素认证",
        }
        return suggestions.get(cwe_id, "请根据具体情况制定修复方案")
