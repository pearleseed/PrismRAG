from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Sequence


class BaseVectorStore(ABC):
    """
    Abstract base class for vector store implementations.
    """

    @abstractmethod
    def add_documents(
        self,
        ids: Sequence[str],
        embeddings: Sequence[list[float]],
        documents: Sequence[str],
        metadatas: Sequence[dict] | None = None,
    ) -> None:
        """Add documents with their embeddings to the store."""
        pass

    @abstractmethod
    def query(
        self,
        query_embedding: list[float],
        n_results: int = 5,
        where: dict | None = None,
        include: list[str] | None = None,
    ) -> dict:
        """Query the store for similar documents."""
        pass

    @abstractmethod
    def delete_by_document_id(self, document_id: int) -> None:
        """Delete all chunks belonging to a specific document."""
        pass

    @abstractmethod
    def delete_collection(self) -> None:
        """Delete the entire collection."""
        pass

    @abstractmethod
    def count(self) -> int:
        """Return the number of documents in the collection."""
        pass

    @abstractmethod
    def get_by_ids(self, ids: Sequence[str]) -> dict:
        """Get documents by their IDs."""
        pass
