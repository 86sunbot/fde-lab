from collections.abc import Sequence
from dataclasses import dataclass

from sklearn.metrics.pairwise import cosine_similarity


@dataclass(frozen=True)
class SearchResult:
    source_number: int
    chunk_number: int
    text: str
    score: float


class InMemoryVectorStore:
    """Small, transparent vector store inherited from V2."""

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
