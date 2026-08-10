import re
from collections.abc import Sequence
from dataclasses import replace

from app.services.vector_store import SearchResult

TOKEN_PATTERN = re.compile(r"[a-z0-9]+")
SEMANTIC_WEIGHT = 0.85
LEXICAL_WEIGHT = 0.15


def _tokens(text: str) -> set[str]:
    return {
        token
        for token in TOKEN_PATTERN.findall(text.lower())
        if len(token) >= 3
    }


def rerank(
    question: str,
    candidates: Sequence[SearchResult],
    top_k: int,
) -> list[SearchResult]:
    """Rerank semantic candidates with a small, inspectable lexical signal."""
    if top_k <= 0:
        raise ValueError("top_k must be positive")

    question_tokens = _tokens(question)

    def score(candidate: SearchResult) -> float:
        candidate_tokens = _tokens(candidate.text)
        lexical_overlap = (
            len(question_tokens & candidate_tokens) / len(question_tokens)
            if question_tokens
            else 0.0
        )
        return SEMANTIC_WEIGHT * candidate.score + LEXICAL_WEIGHT * lexical_overlap

    ranked = sorted(candidates, key=score, reverse=True)[:top_k]
    return [
        replace(candidate, source_number=position)
        for position, candidate in enumerate(ranked, start=1)
    ]
