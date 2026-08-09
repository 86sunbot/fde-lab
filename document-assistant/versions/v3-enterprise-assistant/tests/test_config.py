import pytest
from pydantic import ValidationError

from app.config import Settings


def test_settings_reject_placeholder_secrets() -> None:
    with pytest.raises(ValidationError, match="replace placeholder secrets"):
        Settings(
            _env_file=None,
            openai_api_key="replace-with-your-openai-api-key",
            app_api_key="test-application-api-key",
        )


def test_settings_reject_invalid_chunk_overlap() -> None:
    with pytest.raises(ValidationError, match="CHUNK_OVERLAP"):
        Settings(
            _env_file=None,
            openai_api_key="test-openai-api-key",
            app_api_key="test-application-api-key",
            chunk_size=500,
            chunk_overlap=500,
        )
