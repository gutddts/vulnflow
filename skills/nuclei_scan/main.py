"""
Nuclei 扫描技能
基于模板的漏洞扫描，检测常见漏洞、信息泄露、配置错误和 CVE
"""
import concurrent.futures
import json
import os
import re
import sys
import time
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

import requests
import yaml
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


class NucleiScanner:
    """Nuclei 风格模板扫描器"""

    def __init__(self, config: Dict[str, Any]):
        self.target = config["target"].rstrip("/")
        self.template_filter = config.get("templates", [])
        self.severities = config.get("severities", ["critical", "high", "medium"])
        self.categories = config.get("categories", ["exposure", "misconfiguration", "cve"])
        self.timeout = config.get("timeout", 10)
        self.max_concurrency = config.get("max_concurrency", 10)
        self.headers = config.get("headers", {})
        self.proxy = config.get("proxy")

        self.findings: List[Dict[str, Any]] = []
        self.templates = []
        self.templates_executed = 0

    def _create_session(self) -> requests.Session:
        """创建 HTTP 会话"""
        session = requests.Session()

        retry_strategy = Retry(total=1, backoff_factor=0.3, status_forcelist=[429])
        adapter = HTTPAdapter(max_retries=retry_strategy, pool_maxsize=self.max_concurrency)
        session.mount("http://", adapter)
        session.mount("https://", adapter)

        default_headers = {
            "User-Agent": "Mozilla/5.0 (compatible; VulnFlow-Nuclei/1.0)",
            "Accept": "*/*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        }
        session.headers.update(default_headers)

        if self.headers:
            session.headers.update(self.headers)
        if self.proxy:
            session.proxies = {"http": self.proxy, "https": self.proxy}

        return session

    def _load_templates(self) -> List[Dict[str, Any]]:
        """加载模板"""
        templates_dir = os.path.join(os.path.dirname(__file__), "templates")
        templates = []

        for filename in os.listdir(templates_dir):
            if filename.endswith((".yaml", ".yml")):
                filepath = os.path.join(templates_dir, filename)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        data = yaml.safe_load(f)

                    if data and "templates" in data:
                        for tpl in data["templates"]:
                            # 过滤模板
                            if self.template_filter and tpl["id"] not in self.template_filter:
                                continue
                            if tpl.get("severity", "info") not in self.severities:
                                continue
                            if tpl.get("category", "") not in self.categories:
                                continue
                            templates.append(tpl)
                except Exception as e:
                    print(f"  [警告] 加载模板失败 {filename}: {e}")

        return templates

    def _execute_template(
        self, template: Dict[str, Any], session: requests.Session
    ) -> List[Dict[str, Any]]:
        """执行单个模板"""
        results = []

        for request_def in template.get("requests", []):
            method = request_def.get("method", "GET").upper()
            paths = request_def.get("path", [])

            if isinstance(paths, str):
                paths = [paths]

            # 替换模板变量
            paths = [p.replace("{{.BaseURL}}", self.target) for p in paths]

            for path in paths:
                try:
                    # 构建请求
                    req_kwargs = {
                        "timeout": self.timeout,
                        "allow_redirects": False,
                        "verify": False,
                    }

                    # 添加自定义请求头
                    custom_headers = dict(session.headers)
                    for key, value in request_def.get("headers", {}).items():
                        custom_headers[key] = value
                    req_kwargs["headers"] = custom_headers

                    # 请求体
                    body = request_def.get("body", "")
                    if body:
                        req_kwargs["data"] = body

                    # 发送请求
                    if method == "GET":
                        resp = session.get(path, **req_kwargs)
                    elif method == "POST":
                        resp = session.post(path, **req_kwargs)
                    elif method == "OPTIONS":
                        resp = session.options(path, **req_kwargs)
                    elif method == "PUT":
                        resp = session.put(path, **req_kwargs)
                    elif method == "DELETE":
                        resp = session.delete(path, **req_kwargs)
                    else:
                        continue

                    # 检查匹配器
                    matched, evidence = self._check_matchers(
                        request_def.get("matchers", []), resp
                    )

                    if matched:
                        results.append(
                            {
                                "template_name": template.get("name", template["id"]),
                                "template_id": template["id"],
                                "severity": template.get("severity", "info"),
                                "category": template.get("category", "unknown"),
                                "matched_url": path,
                                "details": template.get("description", ""),
                                "evidence": evidence,
                                "cve_id": template.get("cve_id", ""),
                                "cvss_score": template.get("cvss_score", 0),
                                "remediation": template.get("remediation", ""),
                            }
                        )

                except requests.exceptions.Timeout:
                    pass
                except requests.exceptions.ConnectionError:
                    pass
                except Exception as e:
                    pass

        return results

    def _check_matchers(
        self, matchers: List[Dict[str, Any]], resp: requests.Response
    ) -> tuple:
        """检查响应是否匹配模板规则"""
        if not matchers:
            return False, ""

        for matcher in matchers:
            matcher_type = matcher.get("type", "word")
            condition = matcher.get("condition", "or")

            if matcher_type == "word":
                words = matcher.get("words", [])
                matches = []
                for word in words:
                    if word in resp.text:
                        matches.append(word)

                if condition == "or" and matches:
                    return True, f"匹配关键词: {', '.join(matches)}"
                elif condition == "and" and len(matches) == len(words):
                    return True, f"匹配所有关键词: {', '.join(matches)}"

            elif matcher_type == "status":
                expected_status = matcher.get("status", [])
                if resp.status_code in expected_status:
                    # 状态码匹配还需要其他条件（一般结合 word 使用）
                    # 这里简化处理
                    pass

            elif matcher_type == "regex":
                patterns = matcher.get("regex", [])
                for pattern in patterns:
                    if re.search(pattern, resp.text, re.IGNORECASE):
                        return True, f"正则匹配: {pattern}"

        return False, ""

    def scan(self) -> Dict[str, Any]:
        """执行扫描"""
        start_time = time.time()

        # 加载模板
        self.templates = self._load_templates()
        print(f"[信息] 目标: {self.target}")
        print(f"[信息] 加载模板: {len(self.templates)} 个")
        print(f"[信息] 严重程度: {', '.join(self.severities)}")
        print(f"[信息] 分类: {', '.join(self.categories)}")

        if not self.templates:
            return {
                "findings": [],
                "summary": {
                    "total_findings": 0,
                    "by_severity": {},
                    "by_category": {},
                    "templates_executed": 0,
                    "duration_seconds": round(time.time() - start_time, 2),
                    "error": "没有匹配的模板",
                },
            }

        # 禁用 SSL 警告
        import urllib3

        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

        session = self._create_session()

        # 使用线程池并发执行模板
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_concurrency) as executor:
            future_to_template = {
                executor.submit(self._execute_template, tpl, session): tpl
                for tpl in self.templates
            }

            for future in concurrent.futures.as_completed(future_to_template):
                template = future_to_template[future]
                self.templates_executed += 1
                try:
                    results = future.result()
                    if results:
                        self.findings.extend(results)
                        for r in results:
                            print(
                                f"  [{r['severity'].upper()}] {r['template_name']} - {r['matched_url']}"
                            )
                except Exception as e:
                    print(f"  [错误] {template['id']}: {e}")

        # 按严重程度排序
        severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
        self.findings.sort(key=lambda x: severity_order.get(x["severity"], 5))

        # 统计
        by_severity: Dict[str, int] = {}
        by_category: Dict[str, int] = {}
        for finding in self.findings:
            sev = finding["severity"]
            by_severity[sev] = by_severity.get(sev, 0) + 1
            cat = finding["category"]
            by_category[cat] = by_category.get(cat, 0) + 1

        duration = round(time.time() - start_time, 2)

        return {
            "findings": self.findings,
            "summary": {
                "total_findings": len(self.findings),
                "by_severity": by_severity,
                "by_category": by_category,
                "templates_executed": self.templates_executed,
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

        if "target" not in config:
            raise ValueError("缺少必填字段: target")

        scanner = NucleiScanner(config)
        results = scanner.scan()

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

        summary = results["summary"]
        print(f"\n[完成] Nuclei 扫描完成")
        print(f"  - 发现漏洞: {summary['total_findings']} 个")
        print(f"  - 按严重程度: {summary['by_severity']}")
        print(f"  - 按分类: {summary['by_category']}")
        print(f"  - 模板执行数: {summary['templates_executed']}")
        print(f"  - 耗时: {summary['duration_seconds']} 秒")

        sys.exit(0)

    except FileNotFoundError:
        print(f"[错误] 输入文件不存在: {input_path}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"[错误] JSON 解析失败: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"[错误] 扫描过程异常: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
