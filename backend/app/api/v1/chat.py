"""Chat API endpoints with SSE streaming support."""

from __future__ import annotations

import json
import uuid
from typing import Annotated, AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.api.deps import get_current_user
from app.config import get_settings
from app.core.database import get_db
from app.models.chat_session import ChatMessage, ChatSession
from app.models.user import User
from app.schemas.chat import (
    ChatMessageCreate,
    ChatMessageResponse,
    ChatSessionCreate,
    ChatSessionListResponse,
    ChatSessionResponse,
    ChatSessionUpdate,
    ChatStreamChunk,
)

settings = get_settings()
router = APIRouter()


# ------------------------------------------------------------------ #
#  Chat Sessions CRUD
# ------------------------------------------------------------------ #
@router.post("/sessions", response_model=ChatSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_chat_session(
    body: ChatSessionCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ChatSession:
    """Create a new chat session."""
    session = ChatSession(
        title=body.title,
        model=body.model,
        system_prompt=body.system_prompt,
        context=body.context or {},
        user_id=current_user.id,
        project_id=body.project_id,
    )
    db.add(session)
    await db.flush()
    await db.refresh(session)
    return session


@router.get("/sessions", response_model=ChatSessionListResponse)
async def list_chat_sessions(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    project_id: uuid.UUID | None = Query(default=None),
) -> dict:
    """List chat sessions for the current user."""
    query = select(ChatSession).where(ChatSession.user_id == current_user.id)

    if project_id:
        query = query.where(ChatSession.project_id == project_id)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(ChatSession.updated_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = list(result.scalars().all())

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/sessions/{session_id}", response_model=ChatSessionResponse)
async def get_chat_session(
    session_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ChatSession:
    """Get a chat session with its messages."""
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")
    return session


@router.put("/sessions/{session_id}", response_model=ChatSessionResponse)
async def update_chat_session(
    session_id: uuid.UUID,
    body: ChatSessionUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ChatSession:
    """Update a chat session."""
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(session, field, value)

    await db.flush()
    await db.refresh(session)
    return session


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_chat_session(
    session_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a chat session and all its messages."""
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")
    await db.delete(session)
    await db.flush()


# ------------------------------------------------------------------ #
#  Messages CRUD
# ------------------------------------------------------------------ #
@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageResponse])
async def list_messages(
    session_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[ChatMessage]:
    """List all messages in a chat session."""
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")

    msg_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    )
    return list(msg_result.scalars().all())


@router.post(
    "/sessions/{session_id}/messages",
    response_model=ChatMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_message(
    session_id: uuid.UUID,
    body: ChatMessageCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ChatMessage:
    """Add a non-streaming message to the chat session."""
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")

    message = ChatMessage(
        session_id=session_id,
        role=body.role,
        content=body.content,
    )
    db.add(message)
    await db.flush()
    await db.refresh(message)
    return message


# ------------------------------------------------------------------ #
#  SSE Streaming endpoint
# ------------------------------------------------------------------ #
@router.post("/sessions/{session_id}/stream")
async def stream_chat(
    session_id: uuid.UUID,
    body: ChatMessageCreate,
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> EventSourceResponse:
    """Send a message and stream the AI response via Server-Sent Events."""

    # Verify session exists and belongs to user
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")

    # Save user message
    user_msg = ChatMessage(
        session_id=session_id,
        role="user",
        content=body.content,
    )
    db.add(user_msg)
    await db.flush()

    # Fetch message history for context
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .limit(50)
    )
    history = list(history_result.scalars().all())

    async def event_generator() -> AsyncGenerator[dict, None]:
        assistant_content = ""
        try:
            # Simulate streaming LLM response
            # In production, integrate with LangChain/LangGraph here
            chunks = _simulate_streaming_response(body.content, history)

            for chunk in chunks:
                assistant_content += chunk
                if await request.is_disconnected():
                    break
                yield {"event": "message", "data": json.dumps({"type": "text", "content": chunk})}

            # Save assistant message
            async with async_session_factory() as save_db:
                assistant_msg = ChatMessage(
                    session_id=session_id,
                    role="assistant",
                    content=assistant_content,
                    tokens_used=len(assistant_content.split()),
                )
                save_db.add(assistant_msg)
                await save_db.commit()

            yield {
                "event": "message",
                "data": json.dumps({"type": "done", "content": ""}),
            }

        except Exception as exc:
            yield {
                "event": "message",
                "data": json.dumps({"type": "error", "content": str(exc)}),
            }

    from app.core.database import async_session_factory

    return EventSourceResponse(event_generator())


def _simulate_streaming_response(
    user_content: str,
    history: list[ChatMessage],
) -> list[str]:
    """Simulate a streaming LLM response. Replace with actual LLM call."""
    words = (
        "Based on your request, I'll help you with the penetration testing task. "
        "Let me analyze the scope and determine the best approach. "
        "I recommend starting with reconnaissance to gather information about the target. "
        "Then we can proceed with vulnerability scanning and exploitation if needed. "
        "Would you like me to proceed with this plan?"
    ).split()
    return [word + " " for word in words]


# ------------------------------------------------------------------ #
#  Message management
# ------------------------------------------------------------------ #
@router.delete(
    "/sessions/{session_id}/messages/{message_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
async def delete_message(
    session_id: uuid.UUID,
    message_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a specific message."""
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")

    msg_result = await db.execute(
        select(ChatMessage).where(
            ChatMessage.id == message_id,
            ChatMessage.session_id == session_id,
        )
    )
    message = msg_result.scalar_one_or_none()
    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    await db.delete(message)
    await db.flush()
