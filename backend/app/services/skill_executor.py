"""Docker skill execution service."""

from __future__ import annotations

import asyncio
import json
from typing import Any

import docker
from docker.errors import DockerException, ImageNotFound

from app.config import get_settings
from app.core.logging import logger

settings = get_settings()


class DockerSkillService:
    """Service for executing skills in Docker containers."""

    def __init__(self) -> None:
        try:
            self.client = docker.DockerClient(base_url=settings.DOCKER_HOST)
            self.api_client = docker.APIClient(base_url=settings.DOCKER_HOST)
        except DockerException as exc:
            logger.error("docker_connection_failed", error=str(exc))
            self.client = None
            self.api_client = None

    async def execute_skill(
        self,
        image: str,
        entrypoint: str,
        parameters: dict | None = None,
        environment: dict | None = None,
        timeout: int = 300,
        max_memory_mb: int = 512,
        max_cpu: float = 1.0,
        network: str | None = None,
    ) -> dict[str, Any]:
        """Execute a skill in a Docker container and return the result."""
        if self.client is None:
            return {"success": False, "error": "Docker client not available"}

        try:
            # Ensure image is available
            try:
                self.client.images.get(image)
            except ImageNotFound:
                logger.info("pulling_docker_image", image=image)
                self.client.images.pull(image)

            # Build container config
            container_config: dict[str, Any] = {
                "image": image,
                "entrypoint": entrypoint.split(),
                "detach": True,
                "mem_limit": f"{max_memory_mb}m",
                "nano_cpus": int(max_cpu * 1e9),
                "network_mode": network or settings.SKILL_NETWORK,
                "environment": environment or {},
                "remove": True,
            }

            if parameters:
                container_config["environment"]["SKILL_PARAMETERS"] = json.dumps(parameters)

            # Run container
            container = self.client.containers.run(**container_config)

            # Wait for completion or timeout
            try:
                result = container.wait(timeout=timeout)
                logs = container.logs(stdout=True, stderr=True).decode("utf-8", errors="replace")
                exit_code = result.get("StatusCode", -1)

                return {
                    "success": exit_code == 0,
                    "exit_code": exit_code,
                    "logs": logs,
                    "stdout": logs,
                }
            except Exception:
                # Timeout
                try:
                    container.kill()
                except Exception:
                    pass
                logs = container.logs(stdout=True, stderr=True).decode("utf-8", errors="replace")
                return {
                    "success": False,
                    "exit_code": -1,
                    "error": "Skill execution timed out",
                    "logs": logs,
                }

        except DockerException as exc:
            logger.error("skill_execution_error", error=str(exc))
            return {"success": False, "error": str(exc)}

    async def execute_skill_stream(
        self,
        image: str,
        entrypoint: str,
        parameters: dict | None = None,
        environment: dict | None = None,
        timeout: int = 300,
        max_memory_mb: int = 512,
        max_cpu: float = 1.0,
    ):
        """Execute a skill and yield log lines as they arrive."""
        if self.client is None:
            yield {"type": "error", "data": "Docker client not available"}
            return

        try:
            try:
                self.client.images.get(image)
            except ImageNotFound:
                logger.info("pulling_docker_image", image=image)
                yield {"type": "log", "data": f"Pulling image {image}..."}
                self.client.images.pull(image)

            container_config = {
                "image": image,
                "entrypoint": entrypoint.split(),
                "detach": True,
                "mem_limit": f"{max_memory_mb}m",
                "nano_cpus": int(max_cpu * 1e9),
                "environment": environment or {},
                "remove": True,
            }

            if parameters:
                container_config["environment"]["SKILL_PARAMETERS"] = json.dumps(parameters)

            container = self.client.containers.run(**container_config)

            # Stream logs
            for line in container.logs(stream=True, follow=True):
                decoded = line.decode("utf-8", errors="replace").rstrip()
                if decoded:
                    yield {"type": "log", "data": decoded}

            result = container.wait(timeout=timeout)
            yield {
                "type": "result",
                "data": {
                    "exit_code": result.get("StatusCode", -1),
                    "success": result.get("StatusCode", -1) == 0,
                },
            }

        except DockerException as exc:
            yield {"type": "error", "data": str(exc)}

    def check_image_exists(self, image: str) -> bool:
        """Check if a Docker image exists locally."""
        if self.client is None:
            return False
        try:
            self.client.images.get(image)
            return True
        except ImageNotFound:
            return False

    def pull_image(self, image: str) -> bool:
        """Pull a Docker image."""
        if self.client is None:
            return False
        try:
            self.client.images.pull(image)
            return True
        except DockerException:
            return False
