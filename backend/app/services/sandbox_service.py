"""
沙箱服务 - 提供 Docker-in-Docker 安全隔离执行环境
"""
import asyncio
import json
import logging
import os
import tempfile
import time
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Dict, Optional

logger = logging.getLogger(__name__)


class SandboxService:
    """Docker-in-Docker 安全沙箱，用于隔离执行技能容器"""

    # 默认安全配置
    DEFAULT_SECURITY_CONFIG = {
        "no_new_privileges": True,
        "read_only_rootfs": True,
        "drop_capabilities": ["ALL"],
        "add_capabilities": [],
        "network_mode": "none",  # 默认无网络
    }

    # 默认资源限制
    DEFAULT_RESOURCE_LIMITS = {
        "memory": "256m",
        "memory_swap": "512m",
        "cpu_quota": 50000,  # 50% 的 CPU
        "cpu_period": 100000,
        "pids_limit": 100,
    }

    def __init__(self):
        self._docker = None

    @property
    def docker_client(self):
        """懒加载 Docker 客户端"""
        if self._docker is None:
            try:
                import docker

                self._docker = docker.from_env()
            except Exception as e:
                logger.error("初始化 Docker 客户端失败: %s", e)
                raise RuntimeError(f"Docker 不可用: {e}")
        return self._docker

    async def execute_skill(
        self,
        skill: Dict[str, Any],
        inputs: Dict[str, Any],
        task_id: str,
        network_access: bool = False,
    ) -> Dict[str, Any]:
        """
        在 Docker 沙箱中执行技能

        Args:
            skill: 技能定义
            inputs: 输入参数
            task_id: 任务 ID
            network_access: 是否允许网络访问

        Returns:
            执行结果，包含 status, output, logs, duration 等
        """
        image = skill.get("image", "")
        if not image:
            raise ValueError("技能未指定镜像")

        skill_name = skill.get("name", "unknown")
        timeout = skill.get("timeout_seconds", 300)

        # 准备输入/输出目录
        work_dir = tempfile.mkdtemp(prefix=f"vulnflow_{task_id}_")
        input_dir = os.path.join(work_dir, "input")
        output_dir = os.path.join(work_dir, "output")
        os.makedirs(input_dir, exist_ok=True)
        os.makedirs(output_dir, exist_ok=True)

        # 写入输入数据
        input_file = os.path.join(input_dir, "input.json")
        with open(input_file, "w", encoding="utf-8") as f:
            json.dump(inputs, f, ensure_ascii=False, indent=2)

        # 获取资源限制
        resource_limits = skill.get("resource_limits", {})
        mem_limit = resource_limits.get("memory", self.DEFAULT_RESOURCE_LIMITS["memory"])
        cpu_quota = resource_limits.get(
            "cpu_quota", self.DEFAULT_RESOURCE_LIMITS["cpu_quota"]
        )

        # 安全配置
        security_config = dict(self.DEFAULT_SECURITY_CONFIG)
        if network_access:
            security_config["network_mode"] = "bridge"
        else:
            security_config["network_mode"] = "none"

        # 准备卷挂载
        volumes = {
            input_dir: {"bind": "/input", "mode": "ro"},
            output_dir: {"bind": "/output", "mode": "rw"},
        }

        # 如果有自定义 wordlist 等资源，也挂载进去
        resource_mounts = skill.get("metadata", {}).get("resource_mounts", {})
        for host_path, container_config in resource_mounts.items():
            if os.path.exists(host_path):
                volumes[host_path] = container_config

        # 准备环境变量
        environment = {
            "TASK_ID": task_id,
            "SKILL_NAME": skill_name,
            "PYTHONUNBUFFERED": "1",
        }

        # 注入任务元数据
        if "metadata" in inputs:
            environment["TASK_METADATA"] = json.dumps(inputs["metadata"])

        # 构建容器参数
        container_kwargs = {
            "image": image,
            "command": ["python", "main.py"],
            "volumes": volumes,
            "environment": environment,
            "working_dir": "/app",
            "mem_limit": mem_limit,
            "cpu_quota": cpu_quota,
            "cpu_period": self.DEFAULT_RESOURCE_LIMITS["cpu_period"],
            "pids_limit": self.DEFAULT_RESOURCE_LIMITS["pids_limit"],
            "network_mode": security_config["network_mode"],
            "security_opt": ["no-new-privileges:true"],
            "read_only": security_config["read_only_rootfs"],
            "cap_drop": security_config["drop_capabilities"],
            "detach": True,
            "remove": False,
        }

        # 添加 tmpfs 用于可写临时目录
        container_kwargs["tmpfs"] = {
            "/tmp": "size=64m,noexec,nosuid",
        }

        start_time = time.time()
        container = None
        logs_buffer = []

        try:
            logger.info(
                "启动技能容器: skill=%s, task=%s, image=%s",
                skill_name,
                task_id,
                image,
            )

            # 拉取镜像 (如果不存在)
            try:
                self.docker_client.images.get(image)
            except Exception:
                logger.info("拉取镜像: %s", image)
                self.docker_client.images.pull(image)

            # 创建并启动容器
            container = self.docker_client.containers.run(**container_kwargs)
            logger.info("容器已启动: %s", container.id[:12])

            # 流式读取日志
            try:
                for line in container.logs(stream=True, follow=True):
                    decoded = line.decode("utf-8", errors="replace").rstrip()
                    logs_buffer.append(decoded)
                    logger.debug("[%s] %s", container.id[:12], decoded)
            except Exception as log_err:
                logger.warning("读取容器日志时出错: %s", log_err)

            # 等待容器完成
            try:
                exit_result = container.wait(timeout=timeout)
                exit_code = exit_result.get("StatusCode", -1)
            except Exception:
                # 超时处理
                logger.warning("容器执行超时 (%ds), 强制终止", timeout)
                try:
                    container.kill()
                except Exception:
                    pass
                exit_code = -1
                logs_buffer.append(f"[超时] 技能执行超过 {timeout} 秒")

            duration = time.time() - start_time

            # 读取输出
            output_data = None
            output_error = None
            output_file = os.path.join(output_dir, "results.json")

            if os.path.exists(output_file):
                try:
                    with open(output_file, "r", encoding="utf-8") as f:
                        output_data = json.load(f)
                except (json.JSONDecodeError, IOError) as e:
                    output_error = f"读取输出文件失败: {e}"
                    logger.error("读取输出文件失败: %s", e)
            else:
                output_error = "输出文件不存在: results.json"

            # 验证输出格式
            if output_data is not None:
                output_schema = skill.get("outputs", {}).get("schema", {})
                validation_result = self._validate_output(output_data, output_schema)
                if not validation_result["valid"]:
                    logger.warning(
                        "输出验证失败: %s", validation_result.get("errors", [])
                    )

            # 构建结果
            result = {
                "task_id": task_id,
                "skill_id": skill.get("id", ""),
                "skill_name": skill_name,
                "status": "success" if exit_code == 0 else "failed",
                "exit_code": exit_code,
                "duration_seconds": round(duration, 2),
                "output": output_data,
                "output_error": output_error,
                "logs": logs_buffer[-100:],  # 只保留最后 100 行日志
                "started_at": datetime.fromtimestamp(
                    start_time, tz=timezone.utc
                ).isoformat(),
                "resource_usage": self._get_container_stats(container),
            }

            return result

        except Exception as e:
            logger.error("执行技能失败: %s", e)
            duration = time.time() - start_time
            return {
                "task_id": task_id,
                "skill_id": skill.get("id", ""),
                "skill_name": skill_name,
                "status": "error",
                "exit_code": -1,
                "duration_seconds": round(duration, 2),
                "output": None,
                "output_error": str(e),
                "logs": logs_buffer,
                "started_at": datetime.fromtimestamp(
                    start_time, tz=timezone.utc
                ).isoformat(),
            }

        finally:
            # 清理容器
            if container is not None:
                try:
                    container.remove(force=True)
                    logger.info("容器已清理: %s", container.id[:12])
                except Exception as e:
                    logger.warning("清理容器失败: %s", e)

            # 清理临时目录
            try:
                import shutil

                shutil.rmtree(work_dir, ignore_errors=True)
            except Exception as e:
                logger.warning("清理临时目录失败: %s", e)

    async def execute_skill_with_logs(
        self,
        skill: Dict[str, Any],
        inputs: Dict[str, Any],
        task_id: str,
        network_access: bool = False,
    ) -> AsyncIterator[str]:
        """
        执行技能并流式返回日志

        Args:
            skill: 技能定义
            inputs: 输入参数
            task_id: 任务 ID
            network_access: 是否允许网络访问

        Yields:
            日志行
        """
        yield json.dumps(
            {
                "type": "status",
                "task_id": task_id,
                "status": "starting",
                "message": f"开始执行技能: {skill.get('name', 'unknown')}",
            }
        )

        result = await self.execute_skill(
            skill=skill,
            inputs=inputs,
            task_id=task_id,
            network_access=network_access,
        )

        # 流式输出日志
        for log_line in result.get("logs", []):
            yield json.dumps(
                {
                    "type": "log",
                    "task_id": task_id,
                    "line": log_line,
                }
            )

        # 输出最终结果
        yield json.dumps(
            {
                "type": "result",
                "task_id": task_id,
                "status": result["status"],
                "duration_seconds": result["duration_seconds"],
                "output": result.get("output"),
                "error": result.get("output_error"),
            }
        )

    def _validate_output(
        self, output: Any, schema: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        验证输出是否符合 schema

        Args:
            output: 输出数据
            schema: 输出 schema 定义

        Returns:
            验证结果
        """
        errors = []

        if not schema:
            return {"valid": True, "errors": []}

        # 检查类型
        expected_type = schema.get("type", "object")
        if expected_type == "array" and not isinstance(output, list):
            errors.append(f"期望数组类型，实际为 {type(output).__name__}")
            return {"valid": False, "errors": errors}

        if expected_type == "object" and not isinstance(output, dict):
            errors.append(f"期望对象类型，实际为 {type(output).__name__}")
            return {"valid": False, "errors": errors}

        # 检查必填字段
        if expected_type == "object":
            required_fields = schema.get("required", [])
            for field in required_fields:
                if field not in output:
                    errors.append(f"缺少必填字段: {field}")

        # 检查数组元素
        if expected_type == "array":
            items_schema = schema.get("items", {})
            if items_schema and isinstance(output, list):
                required_fields = items_schema.get("required", [])
                for idx, item in enumerate(output):
                    if isinstance(item, dict):
                        for field in required_fields:
                            if field not in item:
                                errors.append(f"items[{idx}] 缺少必填字段: {field}")

        return {"valid": len(errors) == 0, "errors": errors}

    def _get_container_stats(self, container) -> Optional[Dict[str, Any]]:
        """获取容器资源使用统计"""
        if container is None:
            return None
        try:
            stats = container.stats(stream=False)
            cpu_stats = stats.get("cpu_stats", {})
            memory_stats = stats.get("memory_stats", {})

            # 计算 CPU 使用率
            cpu_delta = (
                cpu_stats.get("cpu_usage", {}).get("total_usage", 0)
                - cpu_stats.get("precpu_stats", {}).get("cpu_usage", {}).get(
                    "total_usage", 0
                )
            )
            system_delta = (
                cpu_stats.get("system_cpu_usage", 0)
                - cpu_stats.get("precpu_stats", {}).get("system_cpu_usage", 0)
            )
            cpu_percent = 0.0
            if system_delta > 0:
                cpu_percent = (cpu_delta / system_delta) * 100.0

            # 内存使用
            memory_usage = memory_stats.get("usage", 0)
            memory_limit = memory_stats.get("limit", 0)
            memory_percent = (
                (memory_usage / memory_limit) * 100.0 if memory_limit > 0 else 0.0
            )

            return {
                "cpu_percent": round(cpu_percent, 2),
                "memory_usage_bytes": memory_usage,
                "memory_limit_bytes": memory_limit,
                "memory_percent": round(memory_percent, 2),
                "network_rx_bytes": sum(
                    net.get("rx_bytes", 0)
                    for net in stats.get("networks", {}).values()
                ),
                "network_tx_bytes": sum(
                    net.get("tx_bytes", 0)
                    for net in stats.get("networks", {}).values()
                ),
            }
        except Exception as e:
            logger.warning("获取容器统计失败: %s", e)
            return None
