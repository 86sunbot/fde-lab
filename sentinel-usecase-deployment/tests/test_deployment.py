from pathlib import Path
from subprocess import CompletedProcess
from uuid import UUID

import pytest
from pydantic import ValidationError

from sentinel_usecase.agent import ReferencePasswordSprayProposer
from sentinel_usecase.deployment import (
    DeploymentPackage,
    DeploymentResult,
    DeploymentTarget,
    PowerShellCsvDeploymentGateway,
    SentinelScheduledAlertRule,
    UnavailableDeploymentGateway,
    build_sentinel_payload,
)
from sentinel_usecase.errors import (
    ApprovalRequiredError,
    DeploymentUnavailableError,
    RuleValidationError,
)
from sentinel_usecase.models import (
    ApprovalDecision,
    DetectionRule,
    HumanApproval,
)
from sentinel_usecase.workflow import UseCaseWorkflow


class RecordingGateway:
    def __init__(self) -> None:
        self.calls = 0
        self.payload: SentinelScheduledAlertRule | None = None

    async def deploy(self, package: DeploymentPackage) -> DeploymentResult:
        self.calls += 1
        self.payload = package.sentinel_payload
        return DeploymentResult(deployed=True, message="test deployment")


def _target() -> DeploymentTarget:
    return DeploymentTarget(
        resource_group="rg-surya-sentinel-lab",
        workspace="law-surya-sentinel-lab",
    )


@pytest.mark.parametrize(
    ("resource_group", "workspace"),
    [
        ("", "law-surya-sentinel-lab"),
        ("rg-surya-sentinel-lab", ""),
        ("another-resource-group", "law-surya-sentinel-lab"),
    ],
)
def test_missing_or_out_of_scope_target_configuration_is_rejected(
    resource_group: str, workspace: str
) -> None:
    with pytest.raises(ValidationError):
        DeploymentTarget(resource_group=resource_group, workspace=workspace)


async def test_deployment_blocked_without_approval(valid_rule: DetectionRule) -> None:
    gateway = RecordingGateway()
    workflow = UseCaseWorkflow(ReferencePasswordSprayProposer())
    with pytest.raises(ApprovalRequiredError):
        await workflow.deploy(valid_rule, None, gateway, _target())
    assert gateway.calls == 0


async def test_deployment_blocked_after_failed_validation(valid_rule: DetectionRule) -> None:
    payload = valid_rule.model_dump(mode="python")
    payload["query"] = valid_rule.query.replace("dcount(UserPrincipalName)", "count()")
    invalid_rule = DetectionRule.model_validate(payload)
    gateway = RecordingGateway()
    approval = HumanApproval(decision=ApprovalDecision.APPROVE, reviewer="Security Analyst")

    with pytest.raises(RuleValidationError):
        await UseCaseWorkflow(ReferencePasswordSprayProposer()).deploy(
            invalid_rule, approval, gateway, _target()
        )
    assert gateway.calls == 0


async def test_approved_valid_rule_reaches_only_injected_gateway(
    valid_rule: DetectionRule,
) -> None:
    gateway = RecordingGateway()
    approval = HumanApproval(decision=ApprovalDecision.APPROVE, reviewer="Security Analyst")
    result = await UseCaseWorkflow(ReferencePasswordSprayProposer()).deploy(
        valid_rule, approval, gateway, _target()
    )
    assert result.deployed is True
    assert gateway.calls == 1
    assert gateway.payload is not None
    assert gateway.payload.properties.enabled is False


async def test_missing_script_fails_closed_after_approval(
    valid_rule: DetectionRule, tmp_path: Path
) -> None:
    approval = HumanApproval(decision=ApprovalDecision.APPROVE, reviewer="Security Analyst")
    gateway = UnavailableDeploymentGateway(tmp_path / "Deploy-SentinelUseCases.ps1")
    with pytest.raises(DeploymentUnavailableError, match="required script not found"):
        await UseCaseWorkflow(ReferencePasswordSprayProposer()).deploy(
            valid_rule, approval, gateway, _target()
        )


def test_sentinel_payload_is_scheduled_and_disabled(valid_rule: DetectionRule) -> None:
    payload = build_sentinel_payload(valid_rule)
    wire = payload.model_dump(mode="json", by_alias=True)
    assert wire["kind"] == "Scheduled"
    assert wire["properties"]["enabled"] is False
    assert wire["properties"]["queryFrequency"] == "PT5M"
    assert wire["properties"]["queryPeriod"] == "PT15M"


async def test_powershell_adapter_writes_exact_csv_contract_then_previews_and_applies(
    valid_rule: DetectionRule, tmp_path: Path
) -> None:
    script_path = tmp_path / "Deploy-SentinelUseCases.ps1"
    script_path.write_text("# test script", encoding="utf-8")
    commands: list[list[str]] = []

    def fake_runner(command: list[str]) -> CompletedProcess[str]:
        commands.append(command)
        return CompletedProcess(command, 0, "Validated 1 use case.", "")

    target = _target()
    package = DeploymentPackage(
        rule_id=UUID("3cb97bc8-8ba1-48f6-bc3b-fb69a197a97c"),
        rule=valid_rule,
        target=target,
        sentinel_payload=build_sentinel_payload(valid_rule),
    )
    gateway = PowerShellCsvDeploymentGateway(
        script_path=script_path,
        subscription_id=UUID("00000000-0000-0000-0000-000000000001"),
        powershell_executable="sh",
        managed_identity=False,
        output_directory=tmp_path,
        command_runner=fake_runner,
    )

    result = await gateway.deploy(package)

    assert result.deployed is True
    assert len(commands) == 2
    assert "-Apply" not in commands[0]
    assert "-Apply" in commands[1]
    csv_path = tmp_path / "deployment-input" / str(package.rule_id) / "sentinel-use-cases.csv"
    query_path = csv_path.parent / "rule.kql"
    csv_text = csv_path.read_text(encoding="utf-8")
    assert "RuleId,DisplayName,Description,Enabled,Severity,QueryFile" in csv_text
    assert ",false,Medium,rule.kql,PT5M,PT15M,GreaterThan,0,CredentialAccess,T1110,true" in csv_text
    assert query_path.read_text(encoding="utf-8") == valid_rule.query.rstrip() + "\n"
