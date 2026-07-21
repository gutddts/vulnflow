"""ASGI middleware components: request ID, logging, and rate limiting."""

from __future__ import annotations

import time
import uuid
from collections import defaultdict
from typing import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.config import get_settings

settings = get_settings()


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Attach a unique request ID to every request/response."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


class LoggingMiddleware(BaseHTTPMiddleware):
    """Log incoming requests with method, path, status, and duration."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        start_time = time.monotonic()
        response = await call_next(request)
        duration_ms = (time.monotonic() - start_time) * 1000

        from app.core.logging import logger

        logger.info(
            "request",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=round(duration_ms, 2),
            client=request.client.host if request.client else "-",
            request_id=getattr(request.state, "request_id", "-"),
        )
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory sliding-window rate limiter.

    For production, replace with Redis-based rate limiting.
    """

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)
        self._window: defaultdict[str, list[float]] = defaultdict(list)

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if request.url.path in ("/health", "/docs", "/redoc", "/openapi.json"):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        window_start = now - settings.RATE_LIMIT_PERIOD_SECONDS

        # Remove expired entries
        self._window[client_ip] = [t for t in self._window[client_ip] if t > window_start]

        if len(self._window[client_ip]) >= settings.RATE_LIMIT_REQUESTS:
            from app.core.exceptions import RateLimitExceededException
            raise RateLimitExceededException(
                detail={
                    "retry_after": settings.RATE_LIMIT_PERIOD_SECONDS,
                    "limit": settings.RATE_LIMIT_REQUESTS,
                }
            )

        self._window[client_ip].append(now)
        return await call_next(request)
