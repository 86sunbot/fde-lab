from pydantic import BaseModel, ConfigDict


class StrictModel(BaseModel):
    """Base contract: unknown fields and implicit type coercion are rejected."""

    model_config = ConfigDict(
        extra="forbid",
        strict=True,
        str_strip_whitespace=True,
        validate_assignment=True,
        validate_by_alias=True,
        validate_by_name=True,
    )
