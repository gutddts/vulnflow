"""
端口扫描技能
TCP 连接扫描、服务版本检测、Banner 抓取和操作系统指纹识别
"""
import concurrent.futures
import json
import os
import re
import socket
import ssl
import struct
import sys
import time
from typing import Any, Dict, List, Optional, Set, Tuple


# 常见端口到服务的映射
COMMON_PORT_SERVICES: Dict[int, str] = {
    21: "ftp",
    22: "ssh",
    23: "telnet",
    25: "smtp",
    53: "dns",
    67: "dhcp",
    68: "dhcp",
    69: "tftp",
    80: "http",
    110: "pop3",
    111: "rpcbind",
    123: "ntp",
    135: "msrpc",
    137: "netbios-ns",
    138: "netbios-dgm",
    139: "netbios-ssn",
    143: "imap",
    161: "snmp",
    162: "snmptrap",
    179: "bgp",
    194: "irc",
    389: "ldap",
    443: "https",
    445: "smb",
    465: "smtps",
    500: "ike",
    514: "syslog",
    515: "printer",
    543: "klogin",
    544: "kshell",
    548: "afp",
    554: "rtsp",
    587: "smtp-submission",
    631: "ipp",
    636: "ldaps",
    873: "rsync",
    902: "vmware-auth",
    993: "imaps",
    995: "pop3s",
    1080: "socks",
    1194: "openvpn",
    1433: "mssql",
    1434: "mssql-monitor",
    1521: "oracle",
    1723: "pptp",
    1883: "mqtt",
    2049: "nfs",
    2082: "cpanel",
    2083: "cpanel-ssl",
    2181: "zookeeper",
    2375: "docker",
    2376: "docker-ssl",
    3000: "grafana",
    3128: "squid",
    3260: "iscsi",
    3306: "mysql",
    3389: "rdp",
    3478: "stun",
    4000: "diablo2",
    4369: "epmd",
    4444: "metasploit",
    4848: "glassfish",
    5000: "upnp",
    5060: "sip",
    5353: "mdns",
    5432: "postgresql",
    5555: "adb",
    5632: "pcanywhere",
    5672: "amqp",
    5900: "vnc",
    5901: "vnc",
    5938: "teamviewer",
    5984: "couchdb",
    5985: "winrm-http",
    5986: "winrm-https",
    6000: "x11",
    6379: "redis",
    6443: "k8s-api",
    6666: "irc",
    6667: "irc",
    7001: "weblogic",
    7002: "weblogic-ssl",
    7077: "spark",
    7474: "neo4j",
    8000: "http-alt",
    8008: "http-alt",
    8009: "ajp",
    8080: "http-proxy",
    8081: "http-proxy",
    8443: "https-alt",
    8888: "http-proxy",
    9000: "sonarqube",
    9042: "cassandra",
    9090: "prometheus",
    9092: "kafka",
    9100: "node-exporter",
    9200: "elasticsearch",
    9300: "elasticsearch-transport",
    9443: "kubernetes",
    9999: "abyss",
    10000: "webmin",
    11211: "memcached",
    15672: "rabbitmq-mgmt",
    27017: "mongodb",
    27018: "mongodb",
    27019: "mongodb",
    28015: "rethinkdb",
    28017: "mongodb-web",
    37777: "dahua-dvr",
    50000: "sap",
    50070: "hadoop-namenode",
    61616: "activemq",
}

# 前 1000 个常用端口
TOP_1000_PORTS = sorted(COMMON_PORT_SERVICES.keys())

# Banner 探测签名
BANNER_PROBES: Dict[str, bytes] = {
    "http": b"GET / HTTP/1.0\r\nHost: localhost\r\n\r\n",
    "ssh": b"SSH-2.0-OpenSSH_8.0\r\n",
    "smtp": b"EHLO test\r\n",
    "ftp": b"",
    "pop3": b"",
    "imap": b"",
    "mysql": b"",
    "redis": b"PING\r\n",
    "memcached": b"stats\r\n",
}


class PortScanner:
    """TCP 端口扫描器"""

    def __init__(self, config: Dict[str, Any]):
        self.target = config["target"]
        self.ports = config.get("ports", [])
        self.port_range = config.get("port_range", "")
        self.timeout = config.get("timeout", 2)
        self.max_concurrency = config.get("max_concurrency", 100)
        self.banner_grab = config.get("banner_grab", True)
        self.os_detection = config.get("os_detection", False)
        self.service_probes = config.get("service_probes", True)

        self.open_ports: List[Dict[str, Any]] = []
        self.os_info: Dict[str, Any] = {
            "detected": False,
            "name": "",
            "accuracy": 0,
        }

    def _resolve_target(self) -> List[str]:
        """解析目标 IP 地址"""
        try:
            addrs = socket.getaddrinfo(self.target, None, socket.AF_INET, socket.SOCK_STREAM)
            ips = set()
            for addr in addrs:
                ips.add(addr[4][0])
            return list(ips)
        except socket.gaierror:
            # 如果解析失败，假设已经是 IP
            return [self.target]

    def _get_ports_to_scan(self) -> List[int]:
        """获取要扫描的端口列表"""
        if self.ports:
            return sorted(self.ports)

        if self.port_range:
            parts = self.port_range.split("-")
            start = int(parts[0])
            end = int(parts[1]) if len(parts) > 1 else start
            return list(range(start, min(end + 1, 65536)))

        # 默认使用常见端口
        return TOP_1000_PORTS

    def _scan_port(self, ip: str, port: int) -> Optional[Dict[str, Any]]:
        """扫描单个端口"""
        sock = None
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(self.timeout)

            result = sock.connect_ex((ip, port))

            if result == 0:
                service = COMMON_PORT_SERVICES.get(port, "unknown")
                banner = ""
                version = ""
                product = ""

                if self.banner_grab or self.service_probes:
                    banner, version, product = self._grab_banner(
                        sock, port, service
                    )

                return {
                    "port": port,
                    "protocol": "tcp",
                    "state": "open",
                    "service": service,
                    "version": version or "",
                    "banner": banner or "",
                    "product": product or "",
                }

            return None

        except socket.timeout:
            return None
        except ConnectionRefusedError:
            return None
        except OSError:
            return None
        finally:
            if sock:
                try:
                    sock.close()
                except Exception:
                    pass

    def _grab_banner(
        self, sock: socket.socket, port: int, service: str
    ) -> Tuple[str, str, str]:
        """抓取服务 Banner"""
        banner = ""
        version = ""
        product = ""

        try:
            sock.settimeout(3)

            # 发送服务探测包
            probe = BANNER_PROBES.get(service, b"\r\n")
            if probe:
                sock.sendall(probe)

            # 接收 Banner
            sock.settimeout(2)
            data = b""
            while True:
                try:
                    chunk = sock.recv(4096)
                    if not chunk:
                        break
                    data += chunk
                    if len(data) > 8192:
                        break
                except socket.timeout:
                    break

            if data:
                banner = data.decode("utf-8", errors="replace").strip()

                # 尝试提取版本信息
                version = self._extract_version(banner, service)

        except Exception:
            pass

        return banner, version, product

    def _extract_version(self, banner: str, service: str) -> str:
        """从 Banner 中提取版本信息"""
        patterns = {
            "ssh": r"SSH-\d+\.\d+-([^\s]+)",
            "http": r"Server:\s*([^\r\n]+)",
            "ftp": r"(\d+\.\d+\.\d+)",
            "mysql": r"(\d+\.\d+\.\d+)",
            "postgresql": r"(\d+\.\d+)",
            "redis": r"redis_version:(\d+\.\d+\.\d+)",
            "smtp": r"(\d+\.\d+\.\d+)",
            "nginx": r"nginx/(\d+\.\d+\.\d+)",
            "apache": r"Apache/(\d+\.\d+\.\d+)",
            "openssh": r"OpenSSH[_-](\d+\.\d+[^\s]*)",
            "tomcat": r"Apache-Coyote/(\d+\.\d+)",
            "jetty": r"Jetty[/(](\d+\.\d+\.\d+)",
        }

        pattern = patterns.get(service)
        if pattern:
            match = re.search(pattern, banner, re.IGNORECASE)
            if match:
                return match.group(1)

        # 通用版本检测
        generic_patterns = [
            r"(\d+\.\d+\.\d+)",
            r"(\d+\.\d+)",
        ]
        for pattern in generic_patterns:
            match = re.search(pattern, banner)
            if match:
                return match.group(1)

        return ""

    def _detect_os(self, ip: str) -> Dict[str, Any]:
        """基础操作系统检测"""
        # 基于 TTL 的简单 OS 检测
        os_info = {"detected": False, "name": "", "accuracy": 0}

        try:
            # 尝试通过不同端口的响应特征判断
            for port in [80, 443, 22, 3389]:
                sock = None
                try:
                    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    sock.settimeout(2)
                    sock.connect((ip, port))
                    sock.settimeout(1)

                    if port == 80:
                        sock.sendall(b"GET / HTTP/1.0\r\n\r\n")
                    elif port == 22:
                        pass  # SSH 会自动发送 banner

                    data = b""
                    try:
                        while True:
                            chunk = sock.recv(4096)
                            if not chunk:
                                break
                            data += chunk
                            if len(data) > 4096:
                                break
                    except socket.timeout:
                        pass

                    text = data.decode("utf-8", errors="replace").lower()

                    # 检测 Windows
                    if any(
                        kw in text
                        for kw in [
                            "windows",
                            "iis",
                            "microsoft",
                            "asp.net",
                            "win32",
                        ]
                    ):
                        os_info = {"detected": True, "name": "Windows", "accuracy": 70}
                        break

                    # 检测 Linux
                    if any(
                        kw in text
                        for kw in ["linux", "ubuntu", "debian", "centos", "red hat"]
                    ):
                        os_info = {"detected": True, "name": "Linux", "accuracy": 70}
                        break

                    # 通过 SSH banner 检测
                    if "ubuntu" in text:
                        os_info = {
                            "detected": True,
                            "name": "Ubuntu Linux",
                            "accuracy": 80,
                        }
                        break
                    if "debian" in text:
                        os_info = {
                            "detected": True,
                            "name": "Debian Linux",
                            "accuracy": 80,
                        }
                        break

                except Exception:
                    pass
                finally:
                    if sock:
                        try:
                            sock.close()
                        except Exception:
                            pass

        except Exception:
            pass

        return os_info

    def scan(self) -> Dict[str, Any]:
        """执行端口扫描"""
        start_time = time.time()

        # 解析目标
        ips = self._resolve_target()
        ports = self._get_ports_to_scan()

        print(f"[信息] 目标: {self.target} ({', '.join(ips)})")
        print(f"[信息] 端口数: {len(ports)}")
        print(f"[信息] 并发数: {self.max_concurrency}")

        # 对每个 IP 执行扫描
        for ip in ips:
            print(f"[扫描] 开始扫描 {ip}")

            # 使用线程池并发扫描
            open_results = []
            with concurrent.futures.ThreadPoolExecutor(
                max_workers=self.max_concurrency
            ) as executor:
                future_to_port = {
                    executor.submit(self._scan_port, ip, port): port
                    for port in ports
                }

                for future in concurrent.futures.as_completed(future_to_port):
                    port = future_to_port[future]
                    try:
                        result = future.result()
                        if result:
                            open_results.append(result)
                            print(f"  [开放] 端口 {port} - {result['service']} {result['version']}".strip())
                    except Exception as e:
                        print(f"  [错误] 端口 {port}: {e}")

            # 排序
            open_results.sort(key=lambda x: x["port"])
            self.open_ports.extend(open_results)

        # OS 检测
        if self.os_detection and ips:
            self.os_info = self._detect_os(ips[0])
            if self.os_info["detected"]:
                print(f"[OS] 检测到: {self.os_info['name']} (准确度: {self.os_info['accuracy']}%)")

        duration = round(time.time() - start_time, 2)

        return {
            "open_ports": self.open_ports,
            "os_info": self.os_info,
            "summary": {
                "total_scanned": len(ports) * len(ips),
                "total_open": len(self.open_ports),
                "total_filtered": 0,
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

        scanner = PortScanner(config)
        results = scanner.scan()

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

        summary = results["summary"]
        print(f"\n[完成] 端口扫描完成")
        print(f"  - 扫描端口数: {summary['total_scanned']}")
        print(f"  - 开放端口数: {summary['total_open']}")
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
