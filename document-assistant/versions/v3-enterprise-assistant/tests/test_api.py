from typing import Optional

from fastapi.testclient import TestClient

from app.config import Settings
from app.errors import UpstreamServiceError
from app.main import create_app
from app.services.rag import AnswerResult
from app.services.vector_store import SearchResult


class FakeAssistant:
    ready = True
    chunk_count = 2
    document_name = "document.pdf"

    def __init__(self) -> None:
        self.last_question: Optional[str] = None

    async def initialize(self) -> None:
        return None

    async def answer(self, question: str) -> AnswerResult:
        self.last_question = question
        return AnswerResult(
            answer="A test answer [Source 1].",
            sources=[
                SearchResult(
                    source_number=1,
                    chunk_number=1,
                    text="Relevant document evidence.",
                    score=0.95,
                )
            ],
        )

    async def close(self) -> None:
        return None


class FailingAssistant(FakeAssistant):
    async def answer(self, question: str) -> AnswerResult:
        raise UpstreamServiceError("The embedding request failed")


class UnexpectedlyFailingAssistant(FakeAssistant):
    async def answer(self, question: str) -> AnswerResult:
        raise RuntimeError("internal implementation detail")


def auth_headers(settings: Settings) -> dict:
    return {
        "Authorization": f"Bearer {settings.app_api_key.get_secret_value()}"
    }


def test_health_and_readiness_are_public(test_settings: Settings) -> None:
    app = create_app(test_settings, assistant=FakeAssistant())

    with TestClient(app) as client:
        health = client.get("/health")
        readiness = client.get("/ready")

    assert health.status_code == 200
    assert health.json() == {"status": "ok", "version": "3.1.0"}
    assert readiness.status_code == 200
    assert readiness.json()["indexed_chunks"] == 2


def test_question_requires_authentication(test_settings: Settings) -> None:
    app = create_app(test_settings, assistant=FakeAssistant())

    with TestClient(app) as client:
        response = client.post(
            "/v1/questions",
            json={"question": "What does the document say?"},
        )

    assert response.status_code == 401


def test_question_is_validated_and_answered(test_settings: Settings) -> None:
    assistant = FakeAssistant()
    app = create_app(test_settings, assistant=assistant)

    with TestClient(app) as client:
        invalid = client.post(
            "/v1/questions",
            headers=auth_headers(test_settings),
            json={"question": "   "},
        )
        valid = client.post(
            "/v1/questions",
            headers=auth_headers(test_settings),
            json={"question": "  What does the document say?  "},
        )

    assert invalid.status_code == 422
    assert valid.status_code == 200
    assert valid.json()["answer"] == "A test answer [Source 1]."
    assert valid.json()["sources"][0]["chunk_number"] == 1
    assert valid.headers["X-Request-ID"] == valid.json()["request_id"]
    assert assistant.last_question == "What does the document say?"


def test_question_rejects_unknown_fields(test_settings: Settings) -> None:
    app = create_app(test_settings, assistant=FakeAssistant())

    with TestClient(app) as client:
        response = client.post(
            "/v1/questions",
            headers=auth_headers(test_settings),
            json={
                "question": "What does the document say?",
                "unexpected": "silently accepting this would weaken the contract",
            },
        )

    assert response.status_code == 422


def test_rate_limit_returns_retry_information(test_settings: Settings) -> None:
    limited_settings = test_settings.model_copy(
        update={"rate_limit_requests": 1, "rate_limit_window_seconds": 60}
    )
    app = create_app(limited_settings, assistant=FakeAssistant())

    with TestClient(app) as client:
        first = client.post(
            "/v1/questions",
            headers=auth_headers(limited_settings),
            json={"question": "First valid question"},
        )
        second = client.post(
            "/v1/questions",
            headers=auth_headers(limited_settings),
            json={"question": "Second valid question"},
        )

    assert first.status_code == 200
    assert second.status_code == 429
    assert int(second.headers["Retry-After"]) >= 1


def test_metrics_require_authentication(test_settings: Settings) -> None:
    app = create_app(test_settings, assistant=FakeAssistant())

    with TestClient(app) as client:
        unauthorized = client.get("/metrics")
        authorized = client.get("/metrics", headers=auth_headers(test_settings))

    assert unauthorized.status_code == 401
    assert authorized.status_code == 200
    assert authorized.json()["total_requests"] >= 2


def test_upstream_failure_has_stable_error_contract(test_settings: Settings) -> None:
    app = create_app(test_settings, assistant=FailingAssistant())

    with TestClient(app) as client:
        response = client.post(
            "/v1/questions",
            headers=auth_headers(test_settings),
            json={"question": "What does the document say?"},
        )

    assert response.status_code == 502
    assert response.json()["detail"] == "The embedding request failed"
    assert response.headers["X-Request-ID"] == response.json()["request_id"]


def test_unexpected_failure_does_not_leak_details(test_settings: Settings) -> None:
    app = create_app(test_settings, assistant=UnexpectedlyFailingAssistant())

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.post(
            "/v1/questions",
            headers=auth_headers(test_settings),
            json={"question": "What does the document say?"},
        )

    assert response.status_code == 500
    assert response.json()["detail"] == "An unexpected application error occurred"
    assert "internal implementation detail" not in response.text
    assert response.headers["X-Request-ID"] == response.json()["request_id"]
