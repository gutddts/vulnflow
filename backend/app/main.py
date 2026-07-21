"""FastAPI application factory."""

from __future__ import annotations

import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.core.exceptions import AppException
from app.core.logging import setup_logging
from app.core.middleware import LoggingMiddleware, RateLimitMiddleware, RequestIDMiddleware
from app.api.router import api_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler for startup and shutdown events."""
    setup_logging()

    # Initialize database pool
    from app.core.database import engine
    # Import all models so they are registered on Base.metadata
    import app.models  # noqa: F401

    # Initialize Redis
    from app.core.redis import init_redis, close_redis
    await init_redis()

    yield

    # Shutdown
    await close_redis()
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-driven penetration testing agent platform",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# ------------------------------------------------------------------ #
#  Middleware (order matters - outermost first)
# ------------------------------------------------------------------ #
app.add_middleware(RequestIDMiddleware)
app.add_middleware(LoggingMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.ENVIRONMENT == "development" else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)

if settings.RATE_LIMIT_ENABLED:
    app.add_middleware(RateLimitMiddleware)


# ------------------------------------------------------------------ #
#  Exception handlers
# ------------------------------------------------------------------ #
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.__class__.__name__,
            "message": exc.message,
            "detail": exc.detail,
            "request_id": getattr(request.state, "request_id", None),
        },
    )


# ------------------------------------------------------------------ #
#  Health check
# ------------------------------------------------------------------ #
@app.get("/health", tags=["Health"])
async def health_check():
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "timestamp": time.time(),
    }


# ------------------------------------------------------------------ #
#  Routers
# ------------------------------------------------------------------ #
app.include_router(api_router, prefix="/api")
