"""Main API router aggregating all v1 routers."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import (
    agents,
    ai_executor,
    ai_proxy,
    auth,
    chat,
    dashboard,
    licenses,
    pdf_export,
    projects,
    reports,
    skills,
    tasks,
    verify,
    websocket,
    workflows,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/v1/auth", tags=["Auth"])
api_router.include_router(projects.router, prefix="/v1/projects", tags=["Projects"])
api_router.include_router(skills.router, prefix="/v1/skills", tags=["Skills"])
api_router.include_router(workflows.router, prefix="/v1/workflows", tags=["Workflows"])
api_router.include_router(tasks.router, prefix="/v1/tasks", tags=["Tasks"])
api_router.include_router(chat.router, prefix="/v1/chat", tags=["Chat"])
api_router.include_router(reports.router, prefix="/v1/reports", tags=["Reports"])
api_router.include_router(pdf_export.router, prefix="/v1", tags=["PDFExport"])
api_router.include_router(dashboard.router, prefix="/v1/dashboard", tags=["Dashboard"])
api_router.include_router(agents.router, prefix="/v1/agents", tags=["Agents"])
api_router.include_router(licenses.router, prefix="/v1/licenses", tags=["Licenses"])
api_router.include_router(ai_proxy.router, prefix="/v1", tags=["AI"])
api_router.include_router(ai_executor.router, prefix="/v1/ai", tags=["AI"])
api_router.include_router(verify.router, prefix="/v1", tags=["Verify"])
api_router.include_router(websocket.router, prefix="/v1/ws", tags=["WebSocket"])
