from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import String, DateTime, Text, JSON, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.document import Document


class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    kg_language: Mapped[str | None] = mapped_column(
        String(50), nullable=True, default=None
    )
    kg_entity_types: Mapped[list | None] = mapped_column(
        JSON, nullable=True, default=None
    )

    # Indexing Consistency (C-05, C-07)
    active_index_version: Mapped[int] = mapped_column(Integer, default=1)
    embedding_model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    embedding_dimension: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )

    # Relationships
    documents: Mapped[list["Document"]] = relationship(
        back_populates="workspace", cascade="all, delete-orphan"
    )
