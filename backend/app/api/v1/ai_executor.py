"""
AI 命令执行器 —— 接收 AI 生成的渗透测试命令，在 Docker 沙箱中执行，
通过 SSE 实时回流输出。
"""

from __future__ import annotations

import json as _json
import socket as _socket
import uuid
from typing import Annotated, AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()

DOCKER_SOCKET = "/var/run/docker.sock"


def _docker_api(method: str, path: str, body_param: dict | None = None, timeout: int = 120) -> dict:
    """通过 Unix socket 直接调用 Docker API（不依赖 docker-py）"""
    s = _socket.socket(_socket.AF_UNIX, _socket.SOCK_STREAM)
    s.settimeout(timeout)
    s.connect(DOCKER_SOCKET)
    
    import json as _jj
    raw = f"{method} {path} HTTP/1.0\r\nHost: localhost\r\n"
    if body_param:
        b = _jj.dumps(body_param)
        raw += f"Content-Type: application/json\r\nContent-Length: {len(b)}\r\n\r\n{b}"
    else:
        raw += "\r\n"
    s.sendall(raw.encode())

    resp = b""
    while True:
        try:
            chunk = s.recv(65536)
            if not chunk:
                break
            resp += chunk
        except _socket.timeout:
            break

    s.close()

    if not resp:
        return {}

    # Parse HTTP response
    try:
        header_end = resp.index(b"\r\n\r\n") + 4
        header_part = resp[:header_end].decode()
        body_bytes = resp[header_end:]

        status_line = header_part.split("\r\n")[0]
        status_code = int(status_line.split(" ")[1])
        
        result = {}
        if body_bytes.strip():
            result = _jj.loads(body_bytes.decode())

        if status_code >= 400:
            msg = result.get("message", body_bytes.decode()[:200])
            raise Exception(f"Docker API {status_code}: {msg}")

        return result
    except Exception:
        if status_code and status_code >= 400:
            raise
        return {}


class ExecCommandRequest(BaseModel):
    target: str = Field(..., description="目标 IP/域名/URL")
    commands: list[str] = Field(..., min_length=1, description="要执行的 shell 命令列表")
    session_id: str = Field(default="")
    image: str = Field(default="ubuntu:22.04", description="Docker 镜像")
    timeout: int = Field(default=300, ge=10, le=1800, description="超时秒数")


@router.post("/exec", status_code=status.HTTP_200_OK)
async def execute_commands(
    body: ExecCommandRequest,
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
):
    """在 Docker 沙箱中执行命令，通过 SSE 实时回流输出。"""
    exec_id = str(uuid.uuid4())[:8]

    async def event_generator() -> AsyncGenerator[dict, None]:
        try:
            yield {"event": "message", "data": _json.dumps({"type": "status", "content": f"🔄 启动执行沙箱 ({body.image})...", "exec_id": exec_id})}

            # 1. 拉取镜像
            yield {"event": "message", "data": _json.dumps({"type": "status", "content": f"📦 准备镜像 {body.image}...", "exec_id": exec_id})}
            try:
                _docker_api("POST", f"/images/create?fromImage={body.image}&tag=latest", {}, timeout=180)
            except Exception:
                pass

            # 2. 构造容器命令
            full_cmd = " && ".join(body.commands)
            setup_cmd = "apk add --no-cache curl 2>/dev/null | tail -1"
            shell_cmd = f"{setup_cmd}\necho ---VULNFLOW-START---\n{full_cmd}\necho ---VULNFLOW-END---"

            # 3. 创建容器
            create = _docker_api("POST", "/containers/create", {
                "Image": body.image,
                "Cmd": ["/bin/sh", "-c", shell_cmd],
                "Env": [f"TARGET={body.target}", f"EXEC_ID={exec_id}"],
                "HostConfig": {
                    "NetworkMode": "bridge",
                    "Memory": 512 * 1024 * 1024,
                    "NanoCPUs": int(0.5 * 1e9),
                    "AutoRemove": True,
                },
                "AttachStdout": True,
                "AttachStderr": True,
            })
            container_id = create.get("Id", "")
            if not container_id:
                raise Exception("创建容器失败：无 ID 返回")
            yield {"event": "message", "data": _json.dumps({"type": "status", "content": f"🚀 容器 {container_id[:12]} 已创建，正在执行...", "exec_id": exec_id})}

            # 4. 启动容器
            _docker_api("POST", f"/containers/{container_id}/start")

            # 5. 实时流式读取日志
            s = _socket.socket(_socket.AF_UNIX, _socket.SOCK_STREAM)
            s.settimeout(body.timeout + 30)
            s.connect(DOCKER_SOCKET)
            req = f"GET /containers/{container_id}/logs?stdout=1&stderr=1&follow=1 HTTP/1.0\r\nHost: localhost\r\n\r\n"
            s.sendall(req.encode())

            full_output = ""
            buf_chunks = b""
            http_headers_done = False

            while True:
                if await request.is_disconnected():
                    break
                try:
                    chunk = s.recv(4096)
                    if not chunk:
                        break
                    buf_chunks += chunk

                    # Skip HTTP headers
                    if not http_headers_done:
                        if b"\r\n\r\n" in buf_chunks:
                            idx = buf_chunks.index(b"\r\n\r\n") + 4
                            buf_chunks = buf_chunks[idx:]
                            http_headers_done = True
                        else:
                            continue

                    # Decode and handle all text
                    text = buf_chunks.decode("utf-8", errors="replace")
                    buf_chunks = b""

                    # Docker logging driver TTY: strip 8-byte frame headers
                    import io as _io
                    if text:
                        # Try simple line splitting
                        for line in text.replace("\r\n", "\n").split("\n"):
                            line = line.strip().strip("\x00")
                            if not line:
                                continue
                            full_output += line + "\n"
                            yield {"event": "message", "data": _json.dumps({
                                "type": "output", "content": line,
                                "full_output": full_output, "exec_id": exec_id,
                            })}
                except _socket.timeout:
                    break
                except Exception:
                    break
            s.close()

            # 6. 获取退出码
            try:
                inspect = _docker_api("GET", f"/containers/{container_id}/json")
                exit_code = inspect.get("State", {}).get("ExitCode", -1)
            except Exception:
                exit_code = -1

            yield {"event": "message", "data": _json.dumps({
                "type": "complete",
                "content": f"\n━━━━━━━━━━━━━\n✅ 执行完成 (退出码: {exit_code})\n📊 输出 {len(full_output)} 字符",
                "exit_code": exit_code, "full_output": full_output, "exec_id": exec_id,
            })}

        except Exception as exc:
            yield {"event": "message", "data": _json.dumps({
                "type": "error", "content": f"❌ 执行器错误: {str(exc)}", "exec_id": exec_id,
            })}

    return EventSourceResponse(event_generator())
