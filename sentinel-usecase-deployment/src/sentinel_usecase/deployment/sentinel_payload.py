from typing import Literal

from pydantic import Field

from sentinel_usecase.models import DetectionRule
from sentinel_usecase.models.base import StrictModel


class SentinelFieldMapping(StrictModel):
    identifier: str
    column_name: str = Field(alias="columnName")


class SentinelEntityMapping(StrictModel):
    entity_type: Literal["IP", "Account"] = Field(alias="entityType")
    field_mappings: tuple[SentinelFieldMapping, ...] = Field(
        min_length=1, alias="fieldMappings"
    )


class SentinelEventGroupingSettings(StrictModel):
    aggregation_kind: Literal["SingleAlert"] = Field(
        default="SingleAlert", alias="aggregationKind"
    )


class SentinelIncidentConfiguration(StrictModel):
    create_incident: Literal[True] = Field(default=True, alias="createIncident")


class SentinelScheduledRuleProperties(StrictModel):
    display_name: str = Field(alias="displayName")
    description: str
    severity: Literal["Low", "Medium", "High", "Informational"]
    enabled: Literal[False]
    query: str
    query_frequency: str = Field(alias="queryFrequency")
    query_period: str = Field(alias="queryPeriod")
    trigger_operator: Literal["GreaterThan"] = Field(alias="triggerOperator")
    trigger_threshold: Literal[0] = Field(alias="triggerThreshold")
    suppression_enabled: Literal[False] = Field(
        default=False, alias="suppressionEnabled"
    )
    suppression_duration: Literal["PT5H"] = Field(
        default="PT5H", alias="suppressionDuration"
    )
    tactics: tuple[Literal["CredentialAccess"], ...]
    techniques: tuple[Literal["T1110"], ...]
    entity_mappings: tuple[SentinelEntityMapping, ...] = Field(
        min_length=1, alias="entityMappings"
    )
    event_grouping_settings: SentinelEventGroupingSettings = Field(
        default_factory=SentinelEventGroupingSettings,
        alias="eventGroupingSettings",
    )
    incident_configuration: SentinelIncidentConfiguration = Field(
        default_factory=SentinelIncidentConfiguration,
        alias="incidentConfiguration",
    )


class SentinelScheduledAlertRule(StrictModel):
    kind: Literal["Scheduled"] = "Scheduled"
    properties: SentinelScheduledRuleProperties


def build_sentinel_payload(rule: DetectionRule) -> SentinelScheduledAlertRule:
    """Deterministically map the internal contract to a Sentinel Scheduled rule payload."""

    entity_mappings = tuple(
        SentinelEntityMapping(
            entity_type=mapping.entity_type,
            field_mappings=tuple(
                SentinelFieldMapping(
                    identifier=field.identifier,
                    column_name=field.column_name,
                )
                for field in mapping.field_mappings
            ),
        )
        for mapping in rule.entity_mappings
    )
    return SentinelScheduledAlertRule(
        properties=SentinelScheduledRuleProperties(
            display_name=rule.display_name,
            description=rule.description,
            severity=rule.severity,
            enabled=rule.enabled,
            query=rule.query,
            query_frequency=rule.query_frequency,
            query_period=rule.query_lookback,
            trigger_operator=rule.trigger_configuration.operator,
            trigger_threshold=rule.trigger_configuration.threshold,
            tactics=rule.tactics,
            techniques=rule.techniques,
            entity_mappings=entity_mappings,
        )
    )
