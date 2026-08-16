import pytest
from pydantic import ValidationError

from sentinel_usecase.agent import ReferencePasswordSprayProposer
from sentinel_usecase.models import (
    DetectionParameters,
    DetectionRequest,
    DetectionRule,
)


def test_valid_detection_request() -> None:
    request = DetectionRequest(requirement="  Create a password spray detection  ")
    assert request.requirement == "Create a password spray detection"


@pytest.mark.parametrize("requirement", ["", "  ", "??"])
def test_invalid_detection_request(requirement: str) -> None:
    with pytest.raises(ValidationError):
        DetectionRequest(requirement=requirement)


async def test_valid_detection_rule() -> None:
    proposal = await ReferencePasswordSprayProposer().propose(
        DetectionRequest(requirement="Create a password spray detection")
    )
    rule = DetectionRule.from_proposal(proposal)
    assert rule.kind == "Scheduled"
    assert rule.required_tables == ("SigninLogs",)


async def test_missing_mandatory_rule_field() -> None:
    proposal = await ReferencePasswordSprayProposer().propose(
        DetectionRequest(requirement="Create a password spray detection")
    )
    payload = proposal.model_dump(mode="python")
    del payload["query"]
    with pytest.raises(ValidationError):
        DetectionRule.model_validate(payload)


@pytest.mark.parametrize(
    "parameters",
    [
        {
            "detection_window_minutes": 15,
            "minimum_distinct_accounts": 1,
            "minimum_failed_attempts": 20,
        },
        {
            "detection_window_minutes": 15,
            "minimum_distinct_accounts": 10,
            "minimum_failed_attempts": 9,
        },
        {
            "detection_window_minutes": "15",
            "minimum_distinct_accounts": 10,
            "minimum_failed_attempts": 20,
        },
    ],
)
def test_invalid_threshold_configuration(parameters: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        DetectionParameters.model_validate(parameters)


async def test_enabled_defaults_to_false_and_cannot_be_true() -> None:
    proposal = await ReferencePasswordSprayProposer().propose(
        DetectionRequest(requirement="Create a password spray detection")
    )
    rule = DetectionRule.from_proposal(proposal)
    assert rule.enabled is False

    payload = rule.model_dump(mode="python")
    payload["enabled"] = True
    with pytest.raises(ValidationError):
        DetectionRule.model_validate(payload)


async def test_unknown_llm_fields_are_rejected() -> None:
    proposal = await ReferencePasswordSprayProposer().propose(
        DetectionRequest(requirement="Create a password spray detection")
    )
    payload = proposal.model_dump(mode="python")
    payload["deployment_command"] = "pwsh deploy.ps1"
    with pytest.raises(ValidationError):
        DetectionRule.model_validate(payload)
