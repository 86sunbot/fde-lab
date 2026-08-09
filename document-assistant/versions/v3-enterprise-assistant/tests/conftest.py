from pathlib import Path

import pytest

from app.config import Settings


@pytest.fixture
def test_settings() -> Settings:
    return Settings(
        _env_file=None,
        environment="test",
        openai_api_key="test-openai-api-key",
        app_api_key="test-application-api-key",
        document_path=Path("document.pdf"),
        rate_limit_requests=10,
        rate_limit_window_seconds=60,
    )
