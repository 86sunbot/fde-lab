from uuid import NAMESPACE_URL, UUID, uuid5

from sentinel_usecase.agent.intent import require_supported_password_spray_request
from sentinel_usecase.agent.proposer import RuleProposer
from sentinel_usecase.deployment.gateway import (
    DeploymentGateway,
    DeploymentPackage,
    DeploymentResult,
    DeploymentTarget,
)
from sentinel_usecase.deployment.sentinel_payload import build_sentinel_payload
from sentinel_usecase.errors import ApprovalRequiredError, RuleValidationError
from sentinel_usecase.models import (
    ApprovalDecision,
    DetectionRequest,
    DetectionRule,
    HumanApproval,
    ValidationState,
)
from sentinel_usecase.validation import RuleValidator


class UseCaseWorkflow:
    """Orchestrate proposal and deterministic gates without granting the LLM side effects."""

    def __init__(self, proposer: RuleProposer, validator: RuleValidator | None = None) -> None:
        self._proposer = proposer
        self._validator = validator or RuleValidator()

    async def generate(self, request: DetectionRequest) -> DetectionRule:
        require_supported_password_spray_request(request)
        proposal = await self._proposer.propose(request)
        rule = DetectionRule.from_proposal(proposal)
        validated = self._validator.validate(rule)
        repair = getattr(self._proposer, "repair", None)
        if validated.validation_status.state is ValidationState.FAILED and callable(repair):
            errors = (
                *validated.validation_status.structural_errors,
                *validated.validation_status.detection_errors,
            )
            repaired_proposal = await repair(request, tuple(errors))
            validated = self._validator.validate(DetectionRule.from_proposal(repaired_proposal))
        return validated

    async def deploy(
        self,
        rule: DetectionRule,
        approval: HumanApproval | None,
        gateway: DeploymentGateway,
        target: DeploymentTarget,
        rule_id: UUID | None = None,
    ) -> DeploymentResult:
        # Re-run deterministic validation at the last possible point to detect edited artifacts.
        validated = self._validator.validate(rule)
        if validated.validation_status.state is not ValidationState.PASSED:
            issues = (
                *validated.validation_status.structural_errors,
                *validated.validation_status.detection_errors,
            )
            raise RuleValidationError("deployment blocked: " + "; ".join(issues))
        if approval is None or approval.decision is not ApprovalDecision.APPROVE:
            raise ApprovalRequiredError("deployment blocked: explicit human APPROVE is required")
        payload = build_sentinel_payload(validated)
        if payload.properties.enabled is not False:
            raise RuleValidationError("deployment blocked: generated payload must be disabled")
        resolved_rule_id = rule_id or uuid5(
            NAMESPACE_URL,
            f"{target.resource_group}/{target.workspace}/{validated.display_name}/{validated.query}",
        )
        package = DeploymentPackage(
            rule_id=resolved_rule_id,
            rule=validated,
            target=target,
            sentinel_payload=payload,
        )
        return await gateway.deploy(package)
