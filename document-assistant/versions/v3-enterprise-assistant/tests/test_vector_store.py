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


def test_vector_store_persists_and_restores_compatible_snapshot(tmp_path) -> None:
    index_path = tmp_path / "index.json"
    original = InMemoryVectorStore()
    original.replace(
        chunks=["identity protection", "lateral movement"],
        embeddings=[[1.0, 0.0], [0.0, 1.0]],
    )
    original.persist(index_path, index_signature="matching-signature")

    restored = InMemoryVectorStore()

    assert restored.restore(index_path, "matching-signature") is True
    assert restored.chunk_count == 2
    assert restored.search([0.0, 1.0], top_k=1)[0].chunk_number == 2


def test_vector_store_rejects_stale_snapshot(tmp_path) -> None:
    index_path = tmp_path / "index.json"
    original = InMemoryVectorStore()
    original.replace(chunks=["old"], embeddings=[[1.0]])
    original.persist(index_path, index_signature="old-signature")

    restored = InMemoryVectorStore()

    assert restored.restore(index_path, "new-signature") is False
    assert restored.ready is False
