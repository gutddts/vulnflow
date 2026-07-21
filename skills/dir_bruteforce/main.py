"""
目录爆破技能
HTTP 目录和文件发现，通过内置词表枚举 Web 服务器上的隐藏路径和文件
"""
import concurrent.futures
import json
import os
import re
import sys
import time
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


# 内置词表 - 常见目录和文件路径
DEFAULT_WORDLIST = [
    # 管理后台
    "admin", "administrator", "admin.php", "admin.asp", "admin.aspx",
    "manager", "manage", "management",
    "login", "signin", "auth", "authenticate",
    "wp-admin", "wp-login.php", "user", "users",
    "cms", "cp", "controlpanel", "dashboard",
    # 配置文件
    "config", "conf", "configuration",
    ".env", ".env.backup", ".env.local", ".env.production",
    ".git/config", ".gitignore",
    "web.config", "Web.config",
    "robots.txt", "sitemap.xml", "crossdomain.xml",
    "phpinfo.php", "info.php", "test.php",
    ".htaccess", ".htpasswd",
    # 备份文件
    "backup", "backups", "backup.zip", "backup.sql",
    "dump.sql", "database.sql", "db.sql",
    "www.zip", "www.tar.gz", "site.zip",
    "old", "temp", "tmp", "test",
    # 开发工具
    ".git", ".svn", ".hg", ".bzr",
    ".git/HEAD", ".svn/entries",
    ".DS_Store", ".idea", ".vscode",
    "node_modules", "vendor", "bower_components",
    # API
    "api", "api/v1", "api/v2", "rest", "graphql",
    "swagger", "swagger.json", "openapi.json",
    "api-docs", "docs", "documentation",
    # 静态资源
    "static", "assets", "public", "resources",
    "images", "img", "css", "js", "javascripts",
    "upload", "uploads", "files", "downloads",
    "media", "content", "data",
    # 日志文件
    "log", "logs", "error.log", "access.log",
    "debug.log", "debug",
    # 常见路径
    "install", "setup", "install.php",
    "readme", "readme.txt", "readme.md", "README.md",
    "changelog", "CHANGELOG.md", "license", "LICENSE",
    "status", "health", "healthcheck", "ping",
    "server-status", "server-info",
    # 敏感文件
    "wp-config.php", "wp-config.bak",
    "config.php", "config.php.bak", "config.inc.php",
    "database.yml", "database.yaml",
    ".aws/credentials", ".ssh/id_rsa",
    # 框架相关
    "rails", "django", "laravel", "symfony",
    "app_dev.php", "app.php",
    "storage/logs/laravel.log",
    # 其他
    "console", "shell", "cmd", "command",
    "cron", "jobs",
    "error", "404", "403", "500",
    "favicon.ico",
    "sso", "oauth", "openid",
    "register", "signup", "join",
    "profile", "account", "settings",
    "search", "s", "q",
    "news", "blog", "forum", "wiki",
    "rss", "feed", "atom",
    "xmlrpc.php",
    "actuator", "actuator/health", "actuator/info",
    "jmx-console", "web-console",
    "invoker/JMXInvokerServlet",
    "druid/index.html",
    "phpMyAdmin", "phpmyadmin", "pma",
    "mysql", "phpPgAdmin",
    "grafana", "kibana",
    "jenkins", "hudson",
    "solr", "solr/admin",
    "traefik", "consul",
]

# 常见文件扩展名
DEFAULT_EXTENSIONS = [
    "php", "html", "htm", "js", "json", "xml", "txt",
    "bak", "backup", "old", "orig", "save",
    "zip", "tar", "tar.gz", "gz", "rar", "7z",
    "sql", "db", "sqlite",
    "git", "svn",
    "asp", "aspx", "jsp", "do", "action",
    "conf", "config", "ini", "cfg",
    "log", "logs",
    "pdf", "doc", "docx", "xls", "xlsx",
    "png", "jpg", "jpeg", "gif", "svg", "ico",
    "css", "scss", "less",
    "md", "rst", "txt",
    "yml", "yaml", "toml",
    "env", "env.example",
    "key", "pem", "crt", "cer", "p12",
    "war", "jar", "ear",
    "swf", "fla",
    "csv", "tsv",
]


class DirectoryBruteforcer:
    """目录爆破器"""

    def __init__(self, config: Dict[str, Any]):
        self.target_url = config["target_url"].rstrip("/")
        self.wordlist = config.get("wordlist", DEFAULT_WORDLIST)
        self.extensions = config.get("extensions", DEFAULT_EXTENSIONS)
        self.status_whitelist = config.get("status_whitelist", [200, 201, 202, 203, 301, 302, 307, 401, 403, 405, 500])
        self.threads = config.get("threads", 20)
        self.timeout = config.get("timeout", 5)
        self.headers = config.get("headers", {})
        self.cookies = config.get("cookies", {})
        self.proxy = config.get("proxy")
        self.follow_redirects = config.get("follow_redirects", False)
        self.analyze_404 = config.get("analyze_404", True)

        self.discovered_paths: List[Dict[str, Any]] = []
        self._baseline_size = 0
        self._baseline_status = 0

    def _create_session(self) -> requests.Session:
        """创建 HTTP 会话"""
        session = requests.Session()

        retry_strategy = Retry(total=1, backoff_factor=0.3, status_forcelist=[429])
        adapter = HTTPAdapter(max_retries=retry_strategy, pool_connections=self.threads, pool_maxsize=self.threads * 2)
        session.mount("http://", adapter)
        session.mount("https://", adapter)

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

    def _get_baseline(self, session: requests.Session):
        """获取基线响应（用于检测自定义 404）"""
        try:
            # 请求一个肯定不存在的路径
            fake_url = f"{self.target_url}/vulnflow_nonexistent_{int(time.time())}"
            resp = session.get(fake_url, timeout=self.timeout, allow_redirects=False)
            self._baseline_size = len(resp.text)
            self._baseline_status = resp.status_code
        except Exception:
            self._baseline_size = 0
            self._baseline_status = 404

    def _extract_title(self, html: str) -> str:
        """从 HTML 中提取标题"""
        match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
        if match:
            return match.group(1).strip()[:200]
        return ""

    def _build_urls(self, path: str) -> List[str]:
        """构建测试 URL"""
        urls = []

        # 添加原始路径
        urls.append(f"{self.target_url}/{path}")

        # 添加带斜杠的路径
        urls.append(f"{self.target_url}/{path}/")

        # 添加扩展名变体
        for ext in self.extensions:
            urls.append(f"{self.target_url}/{path}.{ext}")

        return urls

    def _test_path(
        self, path: str, session: requests.Session
    ) -> List[Dict[str, Any]]:
        """测试单个路径"""
        results = []
        urls = self._build_urls(path)

        for url in urls:
            try:
                resp = session.get(
                    url,
                    timeout=self.timeout,
                    allow_redirects=self.follow_redirects,
                )

                status = resp.status_code
                size = len(resp.text)

                # 检查状态码白名单
                if status not in self.status_whitelist:
                    continue

                # 自定义 404 检测
                if self.analyze_404 and self._baseline_size > 0:
                    # 如果大小和基线相同，且状态码相同，可能是自定义 404
                    if (
                        status == self._baseline_status
                        and abs(size - self._baseline_size) < 50
                    ):
                        continue

                # 获取重定向目标
                redirect = ""
                if status in (301, 302, 307):
                    redirect = resp.headers.get("Location", "")

                # 获取内容类型
                content_type = resp.headers.get("Content-Type", "")

                # 提取标题
                title = ""
                if "text/html" in content_type:
                    title = self._extract_title(resp.text)

                results.append(
                    {
                        "path": url,
                        "status_code": status,
                        "size": size,
                        "redirect": redirect,
                        "content_type": content_type,
                        "title": title,
                    }
                )

            except requests.exceptions.Timeout:
                pass
            except requests.exceptions.ConnectionError:
                pass
            except Exception:
                pass

        return results

    def bruteforce(self) -> Dict[str, Any]:
        """执行目录爆破"""
        start_time = time.time()

        session = self._create_session()

        # 获取基线
        if self.analyze_404:
            print("[信息] 获取 404 基线...")
            self._get_baseline(session)
            print(
                f"  基线状态码: {self._baseline_status}, 基线大小: {self._baseline_size} 字节"
            )

        print(f"[信息] 目标: {self.target_url}")
        print(f"[信息] 词表大小: {len(self.wordlist)}")
        print(f"[信息] 线程数: {self.threads}")

        # 准备所有测试 URL
        all_urls = []
        for path in self.wordlist:
            all_urls.extend(self._build_urls(path))

        print(f"[信息] 测试路径总数: {len(all_urls)}")

        # 使用线程池并发测试
        tested = 0
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.threads) as executor:
            future_to_path = {
                executor.submit(self._test_single_url, url, session): url
                for url in all_urls
            }

            for future in concurrent.futures.as_completed(future_to_path):
                try:
                    result = future.result()
                    if result:
                        self.discovered_paths.append(result)
                        print(
                            f"  [发现] {result['status_code']} - "
                            f"{result['size']:>6}B - {result['path']}"
                        )
                except Exception as e:
                    pass

                tested += 1
                if tested % 500 == 0:
                    print(f"  [进度] {tested}/{len(all_urls)}")

        # 按状态码和路径排序
        self.discovered_paths.sort(key=lambda x: (x["status_code"], x["path"]))

        # 统计
        by_status: Dict[int, int] = {}
        for item in self.discovered_paths:
            s = item["status_code"]
            by_status[s] = by_status.get(s, 0) + 1

        duration = round(time.time() - start_time, 2)

        return {
            "discovered_paths": self.discovered_paths,
            "summary": {
                "total_paths_tested": len(all_urls),
                "total_discovered": len(self.discovered_paths),
                "by_status": {str(k): v for k, v in by_status.items()},
                "duration_seconds": duration,
            },
        }

    def _test_single_url(
        self, url: str, session: requests.Session
    ) -> Optional[Dict[str, Any]]:
        """测试单个 URL"""
        try:
            resp = session.get(
                url,
                timeout=self.timeout,
                allow_redirects=self.follow_redirects,
            )

            status = resp.status_code

            if status not in self.status_whitelist:
                return None

            size = len(resp.text)

            # 自定义 404 检测
            if self.analyze_404 and self._baseline_size > 0:
                if (
                    status == self._baseline_status
                    and abs(size - self._baseline_size) < 50
                ):
                    return None

            redirect = ""
            if status in (301, 302, 307):
                redirect = resp.headers.get("Location", "")

            content_type = resp.headers.get("Content-Type", "")

            title = ""
            if "text/html" in content_type:
                title = self._extract_title(resp.text)

            return {
                "path": url,
                "status_code": status,
                "size": size,
                "redirect": redirect,
                "content_type": content_type,
                "title": title,
            }

        except Exception:
            return None


def main():
    """主入口"""
    input_path = "/input/input.json"
    output_path = "/output/results.json"

    try:
        with open(input_path, "r", encoding="utf-8") as f:
            config = json.load(f)

        if "target_url" not in config:
            raise ValueError("缺少必填字段: target_url")

        bruteforcer = DirectoryBruteforcer(config)
        results = bruteforcer.bruteforce()

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

        summary = results["summary"]
        print(f"\n[完成] 目录爆破完成")
        print(f"  - 测试路径数: {summary['total_paths_tested']}")
        print(f"  - 发现路径数: {summary['total_discovered']}")
        print(f"  - 状态码分布: {summary['by_status']}")
        print(f"  - 耗时: {summary['duration_seconds']} 秒")

        sys.exit(0)

    except FileNotFoundError:
        print(f"[错误] 输入文件不存在: {input_path}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"[错误] JSON 解析失败: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"[错误] 爆破过程异常: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
