"""
Vector Store Service Package
Factory for creating the appropriate vector store implementation.
"""

from __future__ import annotations
import logging
from typing import TYPE_CHECKING

from app.core.config import settings
from app.services.vector_store.base import BaseVectorStore

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


def get_vector_store(workspace_id: int, index_version: int = 1) -> BaseVectorStore:
    """
    Factory function to create a VectorStore implementation based on settings.
    """
    db_type = settings.VECTOR_DATABASE.lower()

    if db_type == "qdrant":
        from app.services.vector_store.qdrant_store import QdrantVectorStore

        return QdrantVectorStore(workspace_id, index_version)
    else:
        # Default to Chroma
        from app.services.vector_store.chroma_store import ChromaVectorStore

        return ChromaVectorStore(workspace_id, index_version)


# For backward compatibility if any code uses the VectorStore class directly
class VectorStore:
    """
    Proxy class for backward compatibility.
    Prefer using get_vector_store() factory function.
    """

    def __new__(cls, workspace_id: int, index_version: int = 1):
        return get_vector_store(workspace_id, index_version)
