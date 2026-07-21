"""WebSocket API endpoints for real-time logs and progress."""

from __future__ import annotations

import json
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_ws
from app.core.database import get_db
from app.models.task import Task
from app.models.user import User

router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections and broadcasts."""

    def __init__(self) -> None:
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, task_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        if task_id not in self._connections:
            self._connections[task_id] = []
        self._connections[task_id].append(websocket)

    def disconnect(self, task_id: str, websocket: WebSocket) -> None:
        if task_id in self._connections:
            self._connections[task_id] = [
                conn for conn in self._connections[task_id] if conn != websocket
            ]
            if not self._connections[task_id]:
                del self._connections[task_id]

    async def broadcast(self, task_id: str, data: dict) -> None:
        if task_id not in self._connections:
            return
        disconnected: list[WebSocket] = []
        for conn in self._connections[task_id]:
            try:
                await conn.send_json(data)
            except Exception:
                disconnected.append(conn)
        for conn in disconnected:
            self.disconnect(task_id, conn)

    async def broadcast_log(self, task_id: str, level: str, message: str, data: dict | None = None) -> None:
        await self.broadcast(task_id, {
            "type": "log",
            "level": level,
            "message": message,
            "data": data,
        })

    async def broadcast_progress(self, task_id: str, progress: float, current_node: str | None = None) -> None:
        await self.broadcast(task_id, {
            "type": "progress",
            "progress": progress,
            "current_node": current_node,
        })

    async def broadcast_status(self, task_id: str, status: str) -> None:
        await self.broadcast(task_id, {
            "type": "status",
            "status": status,
        })

    async def broadcast_result(self, task_id: str, result: dict) -> None:
        await self.broadcast(task_id, {
            "type": "result",
            "result": result,
        })


manager = ConnectionManager()


async def get_current_user_ws(
    websocket: WebSocket,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Authenticate WebSocket connection via query parameter token."""
    from app.core.security import decode_access_token
    from jose import JWTError

    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if user_id is None:
            await websocket.close(code=4001, reason="Invalid token")
            raise WebSocketDisconnect(code=4001)
    except JWTError:
        await websocket.close(code=4001, reason="Invalid token")
        raise WebSocketDisconnect(code=4001)

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        await websocket.close(code=4003, reason="User not found or inactive")
        raise WebSocketDisconnect(code=4003)

    return user


@router.websocket("/tasks/{task_id}/live")
async def task_live(
    websocket: WebSocket,
    task_id: UUID,
    token: str = Query(...),
):
    """WebSocket endpoint for real-time task logs, progress, and status updates."""
    # Manual dependency resolution for WebSocket
    from app.core.database import async_session_factory
    from jose import JWTError
    from app.core.security import decode_access_token

    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if user_id is None:
            await websocket.close(code=4001, reason="Invalid token")
            return
    except JWTError:
        await websocket.close(code=4001, reason="Invalid token")
        return

    async with async_session_factory() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None or not user.is_active:
            await websocket.close(code=4003, reason="Unauthorized")
            return

        # Verify task exists
        task_result = await db.execute(select(Task).where(Task.id == task_id))
        task = task_result.scalar_one_or_none()
        if task is None:
            await websocket.close(code=4004, reason="Task not found")
            return

        task_id_str = str(task_id)

    await manager.connect(task_id_str, websocket)

    try:
        # Send current task state on connection
        await websocket.send_json({
            "type": "state",
            "status": task.status,
            "progress": task.progress,
            "current_node_id": task.current_node_id,
        })

        # Send existing logs
        if task.log:
            for entry in task.log:
                await websocket.send_json({
                    "type": "log",
                    "level": entry.get("level", "info"),
                    "message": entry.get("message", ""),
                    "data": entry.get("data"),
                })

        # Keep connection alive and listen for client messages
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            # Handle ping/pong
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

            # Client can request task state refresh
            elif msg.get("type") == "get_state":
                async with async_session_factory() as db:
                    result = await db.execute(select(Task).where(Task.id == task_id))
                    task = result.scalar_one_or_none()
                    if task:
                        await websocket.send_json({
                            "type": "state",
                            "status": task.status,
                            "progress": task.progress,
                            "current_node_id": task.current_node_id,
                        })

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        manager.disconnect(task_id_str, websocket)


@router.websocket("/projects/{project_id}/live")
async def project_live(
    websocket: WebSocket,
    project_id: UUID,
    token: str = Query(...),
):
    """WebSocket endpoint for project-level real-time updates."""
    from app.core.database import async_session_factory
    from jose import JWTError
    from app.core.security import decode_access_token

    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if user_id is None:
            await websocket.close(code=4001, reason="Invalid token")
            return
    except JWTError:
        await websocket.close(code=4001, reason="Invalid token")
        return

    async with async_session_factory() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None or not user.is_active:
            await websocket.close(code=4003, reason="Unauthorized")
            return

    await websocket.accept()

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
