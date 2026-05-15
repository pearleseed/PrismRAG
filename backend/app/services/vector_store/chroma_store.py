"""
ChromaDB Vector Store Implementation
"""

from __future__ import annotations
import logging
from typing import Sequence, Optional
import chromadb
from chromadb.config import Settings as ChromaSettings

from app.core.config import settings
from app.services.vector_store.base import BaseVectorStore

logger = logging.getLogger(__name__)

# Global ChromaDB client
_chroma_client: Optional[chromadb.HttpClient] = None  # ty:ignore[invalid-type-form]


def get_chroma_client() -> chromadb.HttpClient:  # ty:ignore[invalid-type-form]
    """Get or create the ChromaDB client singleton."""
    global _chroma_client

    if _chroma_client is None:
        logger.info(
            f"Connecting to ChromaDB at {settings.CHROMA_HOST}:{settings.CHROMA_PORT}"
        )
        _chroma_client = chromadb.HttpClient(
            host=settings.CHROMA_HOST,
            port=settings.CHROMA_PORT,
            settings=ChromaSettings(
                anonymized_telemetry=False,
            ),
        )
        # Test connection
        _chroma_client.heartbeat()
        logger.info("Connected to ChromaDB successfully")

    return _chroma_client


class ChromaVectorStore(BaseVectorStore):
    """
    Vector store implementation using ChromaDB.
    """

    COLLECTION_PREFIX = "kb_"

    def __init__(self, workspace_id: int, index_version: int = 1):
        self.workspace_id = workspace_id
        self.index_version = index_version
        self.collection_name = (
            f"{self.COLLECTION_PREFIX}{workspace_id}_v{index_version}"
        )
        self._collection = None

    @property
    def collection(self) -> chromadb.Collection:
        """Get or create the collection."""
        if self._collection is None:
            client = get_chroma_client()
            self._collection = client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"},
            )
        return self._collection

    def add_documents(
        self,
        ids: Sequence[str],
        embeddings: Sequence[list[float]],
        documents: Sequence[str],
        metadatas: Sequence[dict] | None = None,
    ) -> None:
        if not ids:
            return

        try:
            self.collection.upsert(
                ids=list(ids),
                embeddings=list(embeddings),
                documents=list(documents),
                metadatas=list(metadatas) if metadatas else None,
            )
        except Exception as e:
            logger.error(f"Error adding documents to ChromaDB: {e}")
            raise

        logger.info(
            f"Added {len(ids)} documents to ChromaDB collection {self.collection_name}"
        )

    def query(
        self,
        query_embedding: list[float],
        n_results: int = 5,
        where: dict | None = None,
        include: list[str] | None = None,
    ) -> dict:
        if include is None:
            include = ["documents", "metadatas", "distances"]

        try:
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=n_results,
                where=where,
                include=include,  # ty:ignore[invalid-argument-type]
            )
        except Exception as e:
            logger.error(f"Error querying ChromaDB: {e}")
            return {"ids": [], "documents": [], "metadatas": [], "distances": []}

        ids_list = results.get("ids")
        docs_list = results.get("documents")
        metas_list = results.get("metadatas")
        dist_list = results.get("distances")

        return {
            "ids": ids_list[0] if ids_list else [],
            "documents": docs_list[0] if docs_list else [],
            "metadatas": metas_list[0] if metas_list else [],
            "distances": dist_list[0] if dist_list else [],
        }

    def delete_by_document_id(self, document_id: int) -> None:
        self.collection.delete(where={"document_id": document_id})
        logger.info(f"Deleted chunks for document {document_id} from ChromaDB")

    def delete_collection(self) -> None:
        client = get_chroma_client()
        try:
            client.delete_collection(self.collection_name)
            self._collection = None
            logger.info(f"Deleted ChromaDB collection {self.collection_name}")
        except Exception as e:
            logger.warning(
                f"Failed to delete ChromaDB collection {self.collection_name}: {e}"
            )

    def count(self) -> int:
        return self.collection.count()

    def get_by_ids(self, ids: Sequence[str]) -> dict:
        return dict(self.collection.get(ids=list(ids), include=["documents", "metadatas"]))
