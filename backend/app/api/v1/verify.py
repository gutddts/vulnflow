"""漏洞验证 API —— 真实 HTTP 请求验证 AI 发现的漏洞"""

from __future__ import annotations

import httpx
import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/verify", tags=["verify"])

class VerifyRequest(BaseModel):
    """验证请求"""
    target: str = Field(description="目标 IP/域名")
    url_path: str = Field(default="/", description="URL 路径")
    method: str = Field(default="GET", description="HTTP 方法")
    headers: dict[str, str] = Field(default_factory=dict, description="自定义请求头")
    body: str = Field(default="", description="请求体")
    expected_pattern: str = Field(description="验证正则表达式")
    description: str = Field(default="", description="漏洞描述")

class VerifyResponse(BaseModel):
    """验证响应"""
    status: str = Field(description="结果: vulnerable / not_vulnerable / error")
    response_status: int | None = Field(default=None, description="HTTP 状态码")
    response_headers: dict[str, str] | None = Field(default=None)
    response_body_preview: str = Field(default="", description="响应体预览(前 2000 字符)")
    matched: bool = Field(default=False, description="响应是否匹配验证模式")
    error: str | None = Field(default=None)


@router.post("", response_model=VerifyResponse)
async def verify_vulnerability(req: VerifyRequest) -> VerifyResponse:
    """对目标 URL 发送真实 HTTP 请求，验证 AI 发现的漏洞

    流程：
    1. 用 httpx 向目标发送真实 HTTP 请求
    2. 获取真实的响应状态码/头/体
    3. 用 expected_pattern 正则匹配响应体
    4. 返回验证结果
    """
    # 构造完整 URL
    scheme = "https" if req.headers.pop("https", "false") == "true" else "http"
    base = f"{scheme}://{req.target}"
    full_url = base.rstrip("/") + "/" + req.url_path.lstrip("/")

    # 安全限制：只允许 HTTP/HTTPS
    if not full_url.startswith(("http://", "https://")):
        return VerifyResponse(
            status="error",
            error="只允许 HTTP/HTTPS 协议",
        )

    # 添加默认头
    headers = {
        "User-Agent": "VulnFlow-Verify/1.0 (Security Scanner)",
        "Accept": "*/*",
        **req.headers,
    }

    try:
        async with httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True,
            verify=False,  # 忽略 SSL 证书验证（渗透测试场景）
        ) as client:
            if req.method.upper() == "POST":
                resp = await client.post(full_url, headers=headers, content=req.body)
            elif req.method.upper() == "PUT":
                resp = await client.put(full_url, headers=headers, content=req.body)
            else:
                resp = await client.get(full_url, headers=headers)

            body = resp.text[:2000]

            # 用正则匹配响应体
            try:
                pattern = re.compile(req.expected_pattern, re.IGNORECASE | re.DOTALL)
                matched = bool(pattern.search(body))
            except re.error as e:
                return VerifyResponse(
                    status="error",
                    response_status=resp.status_code,
                    error=f"验证模式正则错误: {e}",
                )

            return VerifyResponse(
                status="vulnerable" if matched else "not_vulnerable",
                response_status=resp.status_code,
                response_headers=dict(resp.headers),
                response_body_preview=body,
                matched=matched,
            )

    except httpx.TimeoutException:
        return VerifyResponse(status="error", error="请求超时(30 秒)")
    except httpx.ConnectError as e:
        return VerifyResponse(status="error", error=f"连接失败: {e}")
    except Exception as e:
        return VerifyResponse(status="error", error=f"验证过程出错: {e}")
