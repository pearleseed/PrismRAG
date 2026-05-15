from __future__ import annotations

import enum
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import String, ForeignKey, DateTime, Integer, Text, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.knowledge_base import KnowledgeBase


class IngestionJobStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class IngestionStep(str, enum.Enum):
    CREATED = "created"
    VALIDATING = "validating"
    PROMPT_INJECTION_CHECK = "prompt_injection_check"
    PARSING = "parsing"
    DEDUPLICATING = "deduplicating"
    VECTOR_INDEXING = "vector_indexing"
    GRAPH_INDEXING = "graph_indexing"
    MEDIA_PROCESSING = "media_processing"
    FINALIZING = "finalizing"


class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(
        ForeignKey("knowledge_bases.id", ondelete="CASCADE")
    )
    document_id: Mapped[int] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE")
    )

    status: Mapped[IngestionJobStatus] = mapped_column(
        Enum(IngestionJobStatus), default=IngestionJobStatus.PENDING
    )
    current_step: Mapped[IngestionStep] = mapped_column(
        Enum(IngestionStep), default=IngestionStep.CREATED
    )

    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Checkpointing state
    payload_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    retries: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )

    # Relationships
    document: Mapped["Document"] = relationship()
    workspace: Mapped["KnowledgeBase"] = relationship()
