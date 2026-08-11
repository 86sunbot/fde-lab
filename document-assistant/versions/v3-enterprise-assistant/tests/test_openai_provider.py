from pathlib import Path
from typing import Any

import app.services.openai_provider as provider_module
from app.config import Settings


def test_openai_provider_centralizes_timeout_and_retry_configuration(
    monkeypatch,
) -> None:
    captured: dict[str, Any] = {}

    class FakeAsyncOpenAI:
        def __init__(self, **kwargs: Any) -> None:
            captured.update(kwargs)

    monkeypatch.setattr(provider_module, "AsyncOpenAI", FakeAsyncOpenAI)
    settings = Settings(
        _env_file=None,
        environment="test",
        openai_api_key="test-openai-api-key",
        app_api_key="test-application-api-key",
        document_path=Path("document.pdf"),
        openai_timeout_seconds=12.5,
        openai_max_retries=4,
    )

    provider_module.OpenAIProvider(settings)

    assert captured["api_key"] == "test-openai-api-key"
    assert captured["timeout"] == 12.5
    assert captured["max_retries"] == 4
