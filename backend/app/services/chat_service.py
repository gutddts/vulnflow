"""Chat service - business logic for chat sessions and LLM interaction."""

from __future__ import annotations

from typing import AsyncGenerator, Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat_session import ChatMessage, ChatSession


class ChatService:
    """Service for chat-related business logic."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_session(self, session_id: UUID) -> ChatSession | None:
        result = await self.db.execute(
            select(ChatSession).where(ChatSession.id == session_id)
        )
        return result.scalar_one_or_none()

    async def list_sessions(
        self,
        user_id: UUID,
        page: int = 1,
        page_size: int = 20,
        project_id: Optional[UUID] = None,
    ) -> tuple[list[ChatSession], int]:
        query = select(ChatSession).where(ChatSession.user_id == user_id)
        if project_id:
            query = query.where(ChatSession.project_id == project_id)

        count = (await self.db.execute(
            select(func.count()).select_from(query.subquery())
        )).scalar() or 0

        query = query.order_by(ChatSession.updated_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)
        return list(result.scalars().all()), count

    async def create_session(
        self,
        user_id: UUID,
        title: str,
        model: str = "gpt-4o",
        system_prompt: Optional[str] = None,
        project_id: Optional[UUID] = None,
    ) -> ChatSession:
        session = ChatSession(
            title=title,
            model=model,
            system_prompt=system_prompt,
            user_id=user_id,
            project_id=project_id,
        )
        self.db.add(session)
        await self.db.flush()
        await self.db.refresh(session)
        return session

    async def get_messages(self, session_id: UUID) -> list[ChatMessage]:
        result = await self.db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.asc())
        )
        return list(result.scalars().all())

    async def add_message(
        self,
        session_id: UUID,
        role: str,
        content: str,
        tool_calls: Optional[list[dict]] = None,
        tool_results: Optional[list[dict]] = None,
        tokens_used: Optional[int] = None,
    ) -> ChatMessage:
        message = ChatMessage(
            session_id=session_id,
            role=role,
            content=content,
            tool_calls=tool_calls,
            tool_results=tool_results,
            tokens_used=tokens_used,
        )
        self.db.add(message)
        await self.db.flush()
        await self.db.refresh(message)
        return message

    async def build_chat_history(
        self, session_id: UUID, max_messages: int = 50
    ) -> list[dict]:
        """Build a chat history list suitable for LLM context."""
        messages = await self.get_messages(session_id)
        return [
            {"role": msg.role, "content": msg.content}
            for msg in messages[-max_messages:]
        ]

    async def simulate_stream_response(
        self, user_content: str, history: list[dict]
    ) -> AsyncGenerator[str, None]:
        """Simulate streaming LLM response chunks."""
        response = (
            "Based on your request, I'll help you with the penetration testing task. "
            "Let me analyze the scope and determine the best approach. "
            "I recommend starting with reconnaissance to gather information about the target. "
            "Then we can proceed with vulnerability scanning and exploitation if needed. "
            "Would you like me to proceed with this plan?"
        )
        words = response.split()
        for word in words:
            yield word + " "
