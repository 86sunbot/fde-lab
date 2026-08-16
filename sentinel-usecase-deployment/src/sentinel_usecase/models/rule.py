import re
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import Field, StringConstraints, field_validator, model_validator

from sentinel_usecase.models.base import StrictModel

IsoMinuteDuration = Annotated[str, StringConstraints(pattern=r"^PT[1-9][0-9]*M$")]
KqlIdentifier = Annotated[str, StringConstraints(pattern=r"^[A-Za-z_][A-Za-z0-9_]*$")]


def duration_minutes(value: str) -> int:
    match = re.fullmatch(r"PT([1-9][0-9]*)M", value)
    if match is None:  # Protected by the Pydantic contract; defensive for direct callers.
        raise ValueError(f"unsupported duration: {value}")
    return int(match.group(1))


class ValidationState(StrEnum):
    PENDING = "pending"
    PASSED = "passed"
    FAILED = "failed"


class ValidationStatus(StrictModel):
    state: ValidationState = ValidationState.PENDING
    structural_errors: tuple[str, ...] = ()
    detection_errors: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()


class TelemetryRequirement(StrictModel):
    source: str = Field(min_length=2, max_length=200)
    purpose: str = Field(min_length=5, max_length=500)


class TableFieldRequirement(StrictModel):
    table: KqlIdentifier
    fields: tuple[KqlIdentifier, ...] = Field(min_length=1)

    @field_validator("fields", mode="after")
    @classmethod
    def reject_duplicate_fields(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        if len(value) != len(set(value)):
            raise ValueError("duplicate required fields are not allowed")
        return value


class DetectionParameters(StrictModel):
    detection_window_minutes: int = Field(ge=5, le=1_440)
    minimum_distinct_accounts: int = Field(ge=2, le=10_000)
    minimum_failed_attempts: int = Field(ge=2, le=100_000)

    @model_validator(mode="after")
    def failed_attempts_cover_distinct_accounts(self) -> "DetectionParameters":
        if self.minimum_failed_attempts < self.minimum_distinct_accounts:
            raise ValueError(
                "minimum_failed_attempts must be at least minimum_distinct_accounts"
            )
        return self


class TriggerConfiguration(StrictModel):
    operator: Literal["GreaterThan"] = "GreaterThan"
    threshold: Literal[0] = 0


class EntityFieldMapping(StrictModel):
    identifier: KqlIdentifier
    column_name: KqlIdentifier


class EntityMapping(StrictModel):
    entity_type: Literal["IP", "Account"]
    field_mappings: tuple[EntityFieldMapping, ...] = Field(min_length=1)


class DetectionRuleContent(StrictModel):
    """Typed content an LLM may propose; safety-owned fields are intentionally absent."""

    schema_version: Literal["1.0"] = "1.0"
    kind: Literal["Scheduled"] = "Scheduled"
    display_name: str = Field(min_length=5, max_length=256)
    description: str = Field(min_length=20, max_length=5_000)
    detection_objective: str = Field(min_length=20, max_length=2_000)
    required_telemetry: tuple[TelemetryRequirement, ...] = Field(min_length=1)
    required_tables: tuple[KqlIdentifier, ...] = Field(min_length=1)
    required_fields: tuple[TableFieldRequirement, ...] = Field(min_length=1)
    query: str = Field(min_length=20, max_length=100_000)
    severity: Literal["Low", "Medium", "High", "Informational"]
    query_frequency: IsoMinuteDuration
    query_lookback: IsoMinuteDuration
    trigger_configuration: TriggerConfiguration
    entity_mappings: tuple[EntityMapping, ...] = Field(min_length=1)
    detection_parameters: DetectionParameters
    assumptions: tuple[str, ...] = Field(min_length=1)
    potential_false_positives: tuple[str, ...] = Field(min_length=1)
    tactics: tuple[Literal["CredentialAccess"], ...] = ("CredentialAccess",)
    techniques: tuple[Literal["T1110"], ...] = ("T1110",)

    @field_validator(
        "required_tables", "assumptions", "potential_false_positives", mode="after"
    )
    @classmethod
    def reject_duplicate_strings(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        normalized = [item.casefold() for item in value]
        if len(normalized) != len(set(normalized)):
            raise ValueError("duplicate values are not allowed")
        return value

    @model_validator(mode="after")
    def validate_schedule_and_telemetry(self) -> "DetectionRuleContent":
        table_set = set(self.required_tables)
        field_table_set = {requirement.table for requirement in self.required_fields}
        if len(field_table_set) != len(self.required_fields):
            raise ValueError("each table may appear only once in required_fields")
        if table_set != field_table_set:
            raise ValueError("required_fields tables must exactly match required_tables")

        frequency = duration_minutes(self.query_frequency)
        lookback = duration_minutes(self.query_lookback)
        if lookback < frequency:
            raise ValueError("query_lookback must be at least query_frequency")
        if lookback < self.detection_parameters.detection_window_minutes:
            raise ValueError("query_lookback must cover the detection window")
        return self


class DetectionRuleProposal(DetectionRuleContent):
    """Strict structured-output contract accepted from the LLM."""


class DetectionRule(DetectionRuleContent):
    """Validated application contract passed to deterministic deployment code."""

    validation_status: ValidationStatus = Field(default_factory=ValidationStatus)
    enabled: Literal[False] = False

    @classmethod
    def from_proposal(cls, proposal: DetectionRuleProposal) -> "DetectionRule":
        return cls.model_validate(proposal.model_dump(mode="python"))
