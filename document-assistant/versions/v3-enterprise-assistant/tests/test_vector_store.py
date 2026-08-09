from app.services.vector_store import InMemoryVectorStore


def test_vector_store_returns_ranked_results() -> None:
    store = InMemoryVectorStore()
    store.replace(
        chunks=["identity protection", "unrelated weather"],
        embeddings=[[1.0, 0.0], [0.0, 1.0]],
    )

    results = store.search(question_embedding=[0.9, 0.1], top_k=2)

    assert results[0].chunk_number == 1
    assert results[0].source_number == 1
    assert results[0].score > results[1].score
