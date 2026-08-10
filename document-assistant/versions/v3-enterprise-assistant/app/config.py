from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app import __version__


class Settings(BaseSettings):
    """Validated configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "Enterprise Document Assistant"
    app_version: str = __version__
    environment: Literal["development", "test", "production"] = "development"
    log_level: str = "INFO"

    openai_api_key: SecretStr
    app_api_key: SecretStr
    embedding_model: str = "text-embedding-3-small"
    generation_model: str = "gpt-5.6-terra"
    openai_timeout_seconds: float = Field(default=60.0, gt=0, le=300)
    openai_max_retries: int = Field(default=2, ge=0, le=5)

    document_path: Path = Path("document.pdf")
    vector_store_path: Path = Path(".data/document-index.json")
    max_document_bytes: int = Field(default=20_000_000, ge=1_024, le=1_000_000_000)
    max_document_pages: int = Field(default=200, ge=1, le=10_000)
    chunk_size: int = Field(default=1200, ge=200, le=10_000)
    chunk_overlap: int = Field(default=200, ge=0, le=2_000)
    top_k: int = Field(default=3, ge=1, le=10)
    candidate_k: int = Field(default=6, ge=1, le=50)
    minimum_similarity_score: float = Field(default=0.20, ge=-1.0, le=1.0)

    max_concurrent_questions: int = Field(default=3, ge=1, le=20)
    rate_limit_requests: int = Field(default=10, ge=1, le=10_000)
    rate_limit_window_seconds: int = Field(default=60, ge=1, le=3_600)

    @field_validator("openai_api_key", "app_api_key")
    @classmethod
    def reject_placeholder_secrets(cls, value: SecretStr) -> SecretStr:
        if value.get_secret_value().startswith("replace-with-"):
            raise ValueError("replace placeholder secrets before starting the API")
        return value

    @model_validator(mode="after")
    def validate_related_settings(self) -> "Settings":
        if self.chunk_overlap >= self.chunk_size:
            raise ValueError("CHUNK_OVERLAP must be smaller than CHUNK_SIZE")

        if self.candidate_k < self.top_k:
            raise ValueError("CANDIDATE_K must be greater than or equal to TOP_K")

        if len(self.app_api_key.get_secret_value()) < 16:
            raise ValueError("APP_API_KEY must contain at least 16 characters")

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
