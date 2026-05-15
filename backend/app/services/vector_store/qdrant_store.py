"""
Qdrant Vector Store Implementation
"""

from __future__ import annotations
import logging
from typing import Sequence, Optional
from qdrant_client import QdrantClient, models
from qdrant_client.http.exceptions import UnexpectedResponse

from app.core.config import settings
from app.services.vector_store.base import BaseVectorStore

logger = logging.getLogger(__name__)

# Global Qdrant client
_qdrant_client: Optional[QdrantClient] = None


def get_qdrant_client() -> QdrantClient:
    """Get or create the Qdrant client singleton."""
    global _qdrant_client

    if _qdrant_client is None:
        logger.info(
            f"Connecting to Qdrant at {settings.QDRANT_HOST}:{settings.QDRANT_PORT}"
        )
        _qdrant_client = QdrantClient(
            host=settings.QDRANT_HOST,
            port=settings.QDRANT_PORT,
            grpc_port=settings.QDRANT_GRPC_PORT,
            api_key=settings.QDRANT_API_KEY,
            https=settings.QDRANT_USE_HTTPS,
            prefer_grpc=settings.QDRANT_PREFER_GRPC,
        )
        logger.info("Connected to Qdrant successfully")

    return _qdrant_client


class QdrantVectorStore(BaseVectorStore):
    """
    Vector store implementation using Qdrant.
    Optimized for source code with tuned HNSW parameters.
    """

    COLLECTION_PREFIX = "kb_"

    def __init__(self, workspace_id: int, index_version: int = 1):
        self.workspace_id = workspace_id
        self.index_version = index_version
        self.collection_name = (
            f"{self.COLLECTION_PREFIX}{workspace_id}_v{index_version}"
        )
        self._ensure_collection_exists()

    def _ensure_collection_exists(self) -> None:
        """Create collection if it doesn't exist."""
        client = get_qdrant_client()
        try:
            client.get_collection(self.collection_name)
        except (UnexpectedResponse, Exception):
            logger.info(f"Creating Qdrant collection: {self.collection_name}")
            # Get embedding dimension from settings or a default
            # In a real app, we might want to query the embedder service
            from app.services.embedder import get_embedding_service

            dim = get_embedding_service().dimension

            client.create_collection(
                collection_name=self.collection_name,
                vectors_config=models.VectorParams(
                    size=dim, distance=models.Distance.COSINE
                ),
                # Optimization for source code: higher m and ef_construct for better recall
                hnsw_config=models.HnswConfigDiff(m=16, ef_construct=100),
            )

    def add_documents(
        self,
        ids: Sequence[str],
        embeddings: Sequence[list[float]],
        documents: Sequence[str],
        metadatas: Sequence[dict] | None = None,
    ) -> None:
        if not ids:
            return

        client = get_qdrant_client()
        points = []
        for i, (point_id, vector, doc) in enumerate(zip(ids, embeddings, documents)):
            payload = {
                "document": doc,
                "document_id": metadatas[i].get("document_id") if metadatas else None,
                **(metadatas[i] if metadatas else {}),
            }
            points.append(
                models.PointStruct(
                    id=point_id,  # Qdrant supports UUID or int IDs. If ids are strings, we hope they are UUID-like.
                    vector=vector,
                    payload=payload,
                )
            )

        client.upsert(collection_name=self.collection_name, points=points, wait=True)
        logger.info(
            f"Added {len(ids)} documents to Qdrant collection {self.collection_name}"
        )

    def query(
        self,
        query_embedding: list[float],
        n_results: int = 5,
        where: dict | None = None,
        include: list[str] | None = None,
    ) -> dict:
        client = get_qdrant_client()

        # Convert Chroma-style 'where' to Qdrant 'Filter'
        q_filter = None
        if where:
            must = []
            for key, value in where.items():
                if isinstance(value, dict) and "$in" in value:
                    # Handle Chroma-style $in operator
                    must.append(
                        models.FieldCondition(
                            key=key, match=models.MatchAny(any=list(value["$in"]))
                        )
                    )
                else:
                    # Simple equality
                    must.append(
                        models.FieldCondition(
                            key=key, match=models.MatchValue(value=value)
                        )
                    )
            q_filter = models.Filter(must=must)

        results = client.search(  # ty:ignore[unresolved-attribute]
            collection_name=self.collection_name,
            query_vector=query_embedding,
            query_filter=q_filter,
            limit=n_results,
            with_payload=True,
            with_vectors=False,
        )

        return {
            "ids": [str(r.id) for r in results],
            "documents": [
                r.payload.get("document", "") if r.payload else "" for r in results
            ],
            "metadatas": [r.payload if r.payload else {} for r in results],
            "distances": [
                r.score for r in results
            ],  # Note: Qdrant returns scores, higher is better for Cosine
        }

    def delete_by_document_id(self, document_id: int) -> None:
        client = get_qdrant_client()
        client.delete(
            collection_name=self.collection_name,
            points_selector=models.Filter(
                must=[
                    models.FieldCondition(
                        key="document_id", match=models.MatchValue(value=document_id)
                    )
                ]
            ),
        )
        logger.info(f"Deleted chunks for document {document_id} from Qdrant")

    def delete_collection(self) -> None:
        client = get_qdrant_client()
        try:
            client.delete_collection(self.collection_name)
            logger.info(f"Deleted Qdrant collection {self.collection_name}")
        except Exception as e:
            logger.warning(
                f"Failed to delete Qdrant collection {self.collection_name}: {e}"
            )

    def count(self) -> int:
        client = get_qdrant_client()
        count = client.get_collection(self.collection_name).points_count
        return count if count is not None else 0

    def get_by_ids(self, ids: Sequence[str]) -> dict:
        client = get_qdrant_client()
        results = client.retrieve(
            collection_name=self.collection_name, ids=list(ids), with_payload=True
        )
        return {
            "ids": [str(r.id) for r in results],
            "documents": [
                r.payload.get("document", "") if r.payload else "" for r in results
            ],
            "metadatas": [r.payload if r.payload else {} for r in results],
        }
