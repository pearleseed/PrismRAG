"""
ChatMessage model — persists chat history per workspace to PostgreSQL.
"""

from __future__ import annotations

from datetime import datetime, timezone

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Text, Integer, DateTime, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.conversation import Conversation


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    workspace_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("knowledge_bases.id", ondelete="CASCADE"),
        index=True,
    )
    conversation_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("conversations.id", ondelete="CASCADE"),
        index=True,
        nullable=True,
    )
    message_id: Mapped[str] = mapped_column(String(50), index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Rich metadata (JSON columns — nullable for user messages)
    sources: Mapped[list | None] = mapped_column(JSON, nullable=True)
    related_entities: Mapped[list | None] = mapped_column(JSON, nullable=True)
    image_refs: Mapped[list | None] = mapped_column(JSON, nullable=True)
    thinking: Mapped[str | None] = mapped_column(Text, nullable=True)
    ratings: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    agent_steps: Mapped[list | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )

    # Relationships
    conversation: Mapped["Conversation"] = relationship(back_populates="messages")
