"""AI API 代理 —— 前端通过后端调 AI，避免 CORS 和网络限制"""

from __future__ import annotations

import httpx
import json
from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/ai", tags=["ai"])

class AIProxyRequest(BaseModel):
    """AI 代理请求 —— 前端把调 AI 的参数发给后端，后端转发到真正的 AI API"""
    url: str = Field(description="完整的 AI API URL（如 https://api.deepseek.com/chat/completions）")
    method: str = Field(default="POST", description="HTTP 方法")
    headers: dict[str, str] = Field(default_factory=dict)
    body: dict = Field(default_factory=dict)

class AIProxyResponse(BaseModel):
    """AI 代理响应"""
    status: int = Field(default=200)
    data: dict | None = None
    error: str | None = None


@router.post("/chat", response_model=AIProxyResponse)
async def proxy_ai_chat(req: AIProxyRequest) -> AIProxyResponse:
    """代理转发 AI 请求

    前端无法直接调 AI API（CORS/网络限制），通过本端点转发：
    前端 → 后端（localhost:8000） → 后端 httpx 调用 → 真实 AI API → 返回
    """
    if not req.url:
        return AIProxyResponse(status=400, error="url 必填")

    try:
        async with httpx.AsyncClient(timeout=120.0, verify=False) as client:
            resp = await client.request(
                method=req.method,
                url=req.url,
                headers=req.headers,
                json=req.body,
            )
            try:
                data = resp.json()
            except Exception:
                data = {"raw": resp.text[:2000]}

            if not resp.is_success:
                return AIProxyResponse(
                    status=resp.status_code,
                    data=data,
                    error=f"AI API 返回错误 ({resp.status_code}): {json.dumps(data, ensure_ascii=False)[:200]}",
                )

            return AIProxyResponse(status=resp.status_code, data=data)

    except httpx.TimeoutException:
        return AIProxyResponse(status=504, error="AI API 请求超时（120 秒）")
    except httpx.ConnectError as e:
        return AIProxyResponse(status=502, error=f"连接 AI API 失败: {e}")
    except Exception as e:
        return AIProxyResponse(status=500, error=f"代理请求失败: {e}")
