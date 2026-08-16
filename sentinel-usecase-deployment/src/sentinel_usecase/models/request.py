from pydantic import Field, field_validator

from sentinel_usecase.models.base import StrictModel


class DetectionRequest(StrictModel):
    """A user's natural-language detection requirement."""

    requirement: str = Field(min_length=3, max_length=2_000)

    @field_validator("requirement")
    @classmethod
    def require_meaningful_text(cls, value: str) -> str:
        if not any(character.isalnum() for character in value):
            raise ValueError("requirement must contain letters or numbers")
        return value
