from app.services.reranker import rerank
from app.services.vector_store import SearchResult


def test_reranker_uses_lexical_evidence_to_order_close_candidates() -> None:
    candidates = [
        SearchResult(
            source_number=1,
            chunk_number=1,
            text="General identity product information.",
            score=0.70,
        ),
        SearchResult(
            source_number=2,
            chunk_number=2,
            text="Detect lateral movement through identity activity.",
            score=0.69,
        ),
    ]

    results = rerank("How is lateral movement detected?", candidates, top_k=1)

    assert results[0].chunk_number == 2
    assert results[0].source_number == 1
