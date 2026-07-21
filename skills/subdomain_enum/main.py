"""
子域名枚举技能
通过 DNS 爆破和证书透明度日志发现目标域名的所有子域名
"""
import concurrent.futures
import json
import os
import socket
import ssl
import sys
import time
from typing import Any, Dict, List, Optional, Set

import dns.resolver
import requests


# 内置常用子域名词表
DEFAULT_SUBDOMAIN_WORDLIST = [
    # 通用子域名
    "www", "mail", "ftp", "localhost", "webmail", "smtp", "pop", "pop3",
    "imap", "remote", "blog", "blogs", "test", "dev", "staging", "stage",
    "prod", "production", "demo", "beta", "alpha",
    # 管理
    "admin", "admins", "administrator", "cms", "manage", "manager",
    "cp", "cpanel", "whm", "webmin", "plesk",
    # 安全
    "secure", "ssl", "vpn", "fw", "firewall", "ids", "ips",
    # 网络
    "ns1", "ns2", "ns3", "ns4", "dns1", "dns2",
    "mx", "mx1", "mx2", "mx01", "mx02",
    # 开发
    "api", "api1", "api2", "api-dev", "api-staging", "api-test",
    "rest", "graphql", "ws", "websocket",
    "dev-api", "dev-admin",
    # 基础设施
    "git", "gitlab", "github", "bitbucket", "svn",
    "jenkins", "ci", "cd", "build", "deploy",
    "docker", "k8s", "kubernetes", "rancher",
    "monitor", "monitoring", "metrics", "logs", "logging",
    "status", "health", "healthcheck", "uptime",
    "grafana", "kibana", "prometheus", "alertmanager",
    "elastic", "elasticsearch", "kafka",
    # 数据库
    "db", "db1", "db2", "db01", "db02",
    "mysql", "mysql1", "mysql2",
    "postgres", "postgresql",
    "mongo", "mongodb",
    "redis", "redis1",
    "sql", "sql1",
    # 存储
    "cdn", "cdn1", "cdn2",
    "static", "static1", "static2",
    "assets", "media", "images", "img",
    "files", "file", "storage", "store",
    "uploads", "upload",
    "download", "downloads",
    # 服务
    "docs", "doc", "documentation",
    "help", "support", "ticket", "tickets",
    "wiki", "confluence", "jira",
    "forum", "forums", "community",
    "chat", "slack", "teams",
    "calendar", "cal",
    "search", "sso", "oauth", "auth",
    # 移动
    "m", "mobile", "app", "apps",
    "ios", "android",
    # 邮件
    "email", "newsletter", "news",
    "mailer", "mailman",
    # 商务
    "shop", "store", "pay", "payment",
    "billing", "invoice",
    "partner", "partners", "affiliate", "affiliates",
    "client", "clients", "customer", "customers",
    "vendor", "vendors",
    # 会议
    "meet", "meeting", "video", "conference",
    "zoom", "webex", "teams",
    # 其他
    "v1", "v2", "v3",
    "old", "new", "backup", "archive",
    "temp", "tmp",
    "sandbox", "lab", "labs",
    "internal", "external", "public", "private",
    "corp", "corporate",
    "office", "hr", "finance", "legal",
    "intranet", "extranet",
    "portal", "my", "home",
    "proxy", "gateway", "relay",
    "bastion", "jump",
]

# crt.sh API URL
CRTSH_URL = "https://crt.sh/?q=%25.{}&output=json"


class SubdomainEnumerator:
    """子域名枚举器"""

    def __init__(self, config: Dict[str, Any]):
        self.domain = config["domain"].lower().strip()
        self.wordlist = config.get("wordlist", DEFAULT_SUBDOMAIN_WORDLIST)
        self.use_crtsh = config.get("use_crtsh", True)
        self.resolve_ips = config.get("resolve_ips", True)
        self.dns_servers = config.get("dns_servers", ["8.8.8.8", "1.1.1.1"])
        self.threads = config.get("threads", 50)
        self.timeout = config.get("timeout", 3)

        self.subdomains: Dict[str, Dict[str, Any]] = {}
        self.resolver = self._create_resolver()

    def _create_resolver(self) -> dns.resolver.Resolver:
        """创建 DNS 解析器"""
        resolver = dns.resolver.Resolver()
        resolver.nameservers = self.dns_servers
        resolver.timeout = self.timeout
        resolver.lifetime = self.timeout * 2
        return resolver

    def _resolve_subdomain(
        self, subdomain: str
    ) -> Optional[Dict[str, Any]]:
        """解析子域名的 DNS 记录"""
        fqdn = f"{subdomain}.{self.domain}"

        result = {
            "subdomain": fqdn,
            "ip_addresses": [],
            "source": "dns_bruteforce",
            "cname": "",
        }

        if not self.resolve_ips:
            return result

        try:
            # 尝试 A 记录
            try:
                answers = self.resolver.resolve(fqdn, "A")
                for answer in answers:
                    result["ip_addresses"].append(str(answer))
            except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN):
                pass

            # 尝试 CNAME 记录
            try:
                answers = self.resolver.resolve(fqdn, "CNAME")
                for answer in answers:
                    result["cname"] = str(answer).rstrip(".")
            except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN):
                pass

            # 如果没有 A 记录但有 CNAME，仍然认为存在
            if result["ip_addresses"] or result["cname"]:
                return result

            # 尝试 AAAA 记录
            try:
                answers = self.resolver.resolve(fqdn, "AAAA")
                for answer in answers:
                    result["ip_addresses"].append(str(answer))
            except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN):
                pass

            if result["ip_addresses"] or result["cname"]:
                return result

        except dns.resolver.NXDOMAIN:
            return None
        except dns.resolver.NoNameservers:
            return None
        except dns.resolver.Timeout:
            return None
        except Exception:
            return None

        return None

    def _dns_bruteforce(self) -> Dict[str, Dict[str, Any]]:
        """DNS 爆破子域名"""
        results = {}
        total = len(self.wordlist)
        completed = 0

        print(f"[信息] DNS 爆破: {total} 个子域名")

        with concurrent.futures.ThreadPoolExecutor(max_workers=self.threads) as executor:
            future_to_sub = {
                executor.submit(self._resolve_subdomain, sub): sub
                for sub in self.wordlist
            }

            for future in concurrent.futures.as_completed(future_to_sub):
                sub = future_to_sub[future]
                completed += 1
                try:
                    result = future.result()
                    if result:
                        results[result["subdomain"]] = result
                        ips = ", ".join(result["ip_addresses"]) if result["ip_addresses"] else "无 IP"
                        print(f"  [发现] {result['subdomain']} -> {ips}")
                except Exception:
                    pass

                if completed % 100 == 0:
                    print(f"  [进度] {completed}/{total}, 已发现: {len(results)}")

        return results

    def _crtsh_enum(self) -> Dict[str, Dict[str, Any]]:
        """通过 crt.sh 证书透明度日志查询子域名"""
        results = {}

        try:
            print(f"[信息] 查询 crt.sh 证书透明度日志...")
            url = CRTSH_URL.format(self.domain)
            resp = requests.get(url, timeout=30, headers={
                "User-Agent": "Mozilla/5.0 (compatible; VulnFlow/1.0)"
            })

            if resp.status_code != 200:
                print(f"  [警告] crt.sh 返回状态码: {resp.status_code}")
                return results

            data = resp.json()
            seen = set()

            for entry in data:
                name_value = entry.get("name_value", "")
                # 处理多域名证书
                names = name_value.split("\n")
                for name in names:
                    name = name.strip().lower()
                    # 移除通配符前缀
                    if name.startswith("*."):
                        name = name[2:]

                    if name.endswith(f".{self.domain}") or name == self.domain:
                        if name not in seen and name not in self.subdomains:
                            seen.add(name)

                            result = {
                                "subdomain": name,
                                "ip_addresses": [],
                                "source": "certificate_transparency",
                                "cname": "",
                            }

                            # 解析 IP
                            if self.resolve_ips:
                                try:
                                    resolved = self._resolve_subdomain(
                                        name[:-(len(self.domain) + 1)]
                                        if name != self.domain
                                        else ""
                                    )
                                    if resolved:
                                        result["ip_addresses"] = resolved.get(
                                            "ip_addresses", []
                                        )
                                        result["cname"] = resolved.get("cname", "")
                                except Exception:
                                    pass

                            results[name] = result
                            print(f"  [CT日志] {name}")

            print(f"  [信息] crt.sh 发现: {len(results)} 个子域名")

        except requests.exceptions.Timeout:
            print("  [警告] crt.sh 查询超时")
        except requests.exceptions.ConnectionError:
            print("  [警告] 无法连接 crt.sh")
        except json.JSONDecodeError:
            print("  [警告] crt.sh 返回格式异常")
        except Exception as e:
            print(f"  [警告] crt.sh 查询异常: {e}")

        return results

    def enumerate(self) -> Dict[str, Any]:
        """执行子域名枚举"""
        start_time = time.time()

        print(f"[信息] 目标域名: {self.domain}")

        # DNS 爆破
        dns_results = self._dns_bruteforce()
        self.subdomains.update(dns_results)

        # 证书透明度查询
        if self.use_crtsh:
            ct_results = self._crtsh_enum()
            self.subdomains.update(ct_results)

        # 转换为列表并排序
        subdomain_list = sorted(self.subdomains.values(), key=lambda x: x["subdomain"])

        # 统计
        by_source: Dict[str, int] = {}
        resolved_count = 0
        for s in subdomain_list:
            source = s["source"]
            by_source[source] = by_source.get(source, 0) + 1
            if s["ip_addresses"]:
                resolved_count += 1

        duration = round(time.time() - start_time, 2)

        return {
            "subdomains": subdomain_list,
            "summary": {
                "total_discovered": len(subdomain_list),
                "resolved_count": resolved_count,
                "by_source": by_source,
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

        if "domain" not in config:
            raise ValueError("缺少必填字段: domain")

        enumerator = SubdomainEnumerator(config)
        results = enumerator.enumerate()

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

        summary = results["summary"]
        print(f"\n[完成] 子域名枚举完成")
        print(f"  - 发现子域名: {summary['total_discovered']} 个")
        print(f"  - 已解析 IP: {summary['resolved_count']} 个")
        print(f"  - 来源分布: {summary['by_source']}")
        print(f"  - 耗时: {summary['duration_seconds']} 秒")

        sys.exit(0)

    except FileNotFoundError:
        print(f"[错误] 输入文件不存在: {input_path}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"[错误] JSON 解析失败: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"[错误] 枚举过程异常: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
