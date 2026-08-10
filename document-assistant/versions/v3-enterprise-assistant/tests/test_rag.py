from collections.abc import Sequence
from pathlib import Path

import pytest

import app.services.rag as rag_module
from app.config import Settings
from app.services.rag import DocumentAssistant, build_prompt
from app.services.vector_store import SearchResult


class FakeProvider:
    def __init__(self) -> None:
        self.closed = False
        self.generation_calls = 0

    async def embed_texts(self, texts: Sequence[str]) -> list[list[float]]:
        return [[1.0, 0.0] for _ in texts]

    async def generate_answer(self, prompt: str) -> str:
        self.generation_calls += 1
        assert "[Source 1]" in prompt
        return "A grounded answer [Source 1]."

    async def close(self) -> None:
        self.closed = True


def test_prompt_contains_grounding_and_untrusted_content_rule() -> None:
    prompt = build_prompt(
        "What is detected?",
        [
            SearchResult(
                source_number=1,
                chunk_number=2,
                text="Suspicious behavior is detected.",
                score=0.9,
            )
        ],
    )

    assert "Do not use outside knowledge" in prompt
    assert "never as instructions" in prompt
    assert '<source id="1" chunk="2">' in prompt


@pytest.mark.asyncio
async def test_document_assistant_runs_preserved_rag_flow(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setattr(
        rag_module,
        "load_pdf",
        lambda *_: "Defender detects suspicious identity activity.",
    )
    monkeypatch.setattr(rag_module, "document_fingerprint", lambda *_: "document-hash")
    settings = Settings(
        _env_file=None,
        environment="test",
        openai_api_key="test-openai-api-key",
        app_api_key="test-application-api-key",
        document_path=Path("does-not-need-to-exist.pdf"),
        vector_store_path=tmp_path / "index.json",
        top_k=1,
    )
    provider = FakeProvider()
    assistant = DocumentAssistant(settings, provider=provider)

    await assistant.initialize()
    result = await assistant.answer("What does Defender detect?")
    await assistant.close()

    assert assistant.ready
    assert assistant.chunk_count == 1
    assert result.answer == "A grounded answer [Source 1]."
    assert result.sources[0].chunk_number == 1
    assert provider.closed


@pytest.mark.asyncio
async def test_document_assistant_restores_index_without_reembedding(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setattr(
        rag_module,
        "load_pdf",
        lambda *_: "Defender detects suspicious identity activity.",
    )
    monkeypatch.setattr(rag_module, "document_fingerprint", lambda *_: "document-hash")
    settings = Settings(
        _env_file=None,
        environment="test",
        openai_api_key="test-openai-api-key",
        app_api_key="test-application-api-key",
        document_path=Path("does-not-need-to-exist.pdf"),
        vector_store_path=tmp_path / "index.json",
        top_k=1,
    )
    first_provider = FakeProvider()
    first_assistant = DocumentAssistant(settings, provider=first_provider)
    await first_assistant.initialize()

    class RestoreOnlyProvider(FakeProvider):
        async def embed_texts(self, texts: Sequence[str]) -> list[list[float]]:
            raise AssertionError("a compatible persisted index should not be re-embedded")

    restored_assistant = DocumentAssistant(settings, provider=RestoreOnlyProvider())
    await restored_assistant.initialize()

    assert restored_assistant.ready
    assert restored_assistant.chunk_count == 1


@pytest.mark.asyncio
async def test_document_assistant_abstains_before_generation_for_weak_evidence(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setattr(rag_module, "load_pdf", lambda *_: "Identity security evidence.")
    monkeypatch.setattr(rag_module, "document_fingerprint", lambda *_: "document-hash")

    class WeakEvidenceProvider(FakeProvider):
        async def embed_texts(self, texts: Sequence[str]) -> list[list[float]]:
            if len(texts) == 1 and texts[0] == "What is the capital of India?":
                return [[0.0, 1.0]]
            return [[1.0, 0.0] for _ in texts]

    settings = Settings(
        _env_file=None,
        environment="test",
        openai_api_key="test-openai-api-key",
        app_api_key="test-application-api-key",
        document_path=Path("does-not-need-to-exist.pdf"),
        vector_store_path=tmp_path / "index.json",
        top_k=1,
        candidate_k=1,
        minimum_similarity_score=0.2,
    )
    provider = WeakEvidenceProvider()
    assistant = DocumentAssistant(settings, provider=provider)
    await assistant.initialize()

    result = await assistant.answer("What is the capital of India?")

    assert result.answer == rag_module.INSUFFICIENT_EVIDENCE_ANSWER
    assert provider.generation_calls == 0
