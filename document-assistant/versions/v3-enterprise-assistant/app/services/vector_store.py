import json
import os
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from sklearn.metrics.pairwise import cosine_similarity


@dataclass(frozen=True)
class SearchResult:
    source_number: int
    chunk_number: int
    text: str
    score: float


class InMemoryVectorStore:
    """Transparent in-memory search with a local JSON persistence snapshot."""

    SCHEMA_VERSION = 1

    def __init__(self) -> None:
        self._chunks: list[str] = []
        self._embeddings: list[list[float]] = []

    @property
    def ready(self) -> bool:
        return bool(self._chunks and self._embeddings)

    @property
    def chunk_count(self) -> int:
        return len(self._chunks)

    def replace(self, chunks: Sequence[str], embeddings: Sequence[Sequence[float]]) -> None:
        if not chunks:
            raise ValueError("at least one document chunk is required")
        if len(chunks) != len(embeddings):
            raise ValueError("every chunk must have exactly one embedding")
        if not embeddings or not embeddings[0]:
            raise ValueError("embedding vectors must not be empty")

        dimensions = len(embeddings[0])
        if any(len(embedding) != dimensions for embedding in embeddings):
            raise ValueError("all embedding vectors must have the same dimensions")

        self._chunks = list(chunks)
        self._embeddings = [list(embedding) for embedding in embeddings]

    def restore(self, path: Path, index_signature: str) -> bool:
        """Restore a compatible snapshot; return False for a miss or corrupt cache."""
        if not path.is_file():
            return False

        try:
            payload: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
            if payload.get("schema_version") != self.SCHEMA_VERSION:
                return False
            if payload.get("index_signature") != index_signature:
                return False
            self.replace(payload["chunks"], payload["embeddings"])
        except (KeyError, TypeError, ValueError, OSError, json.JSONDecodeError):
            return False

        return True

    def persist(self, path: Path, index_signature: str) -> None:
        """Atomically persist the current index so restarts can avoid re-embedding."""
        if not self.ready:
            raise RuntimeError("the vector store has not been initialized")

        path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = path.with_suffix(f"{path.suffix}.tmp")
        payload = {
            "schema_version": self.SCHEMA_VERSION,
            "index_signature": index_signature,
            "chunks": self._chunks,
            "embeddings": self._embeddings,
        }
        temporary_path.write_text(
            json.dumps(payload, separators=(",", ":")),
            encoding="utf-8",
        )
        os.replace(temporary_path, path)

    def search(
        self,
        question_embedding: Sequence[float],
        top_k: int,
    ) -> list[SearchResult]:
        if not self.ready:
            raise RuntimeError("the vector store has not been initialized")
        if not question_embedding:
            raise ValueError("question embedding must not be empty")

        similarities = cosine_similarity(
            [list(question_embedding)],
            self._embeddings,
        )[0]
        result_count = min(top_k, len(self._chunks))
        top_indices = similarities.argsort()[::-1][:result_count]

        return [
            SearchResult(
                source_number=position,
                chunk_number=int(chunk_index) + 1,
                text=self._chunks[chunk_index],
                score=float(similarities[chunk_index]),
            )
            for position, chunk_index in enumerate(top_indices, start=1)
        ]
