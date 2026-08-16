import pytest

from sentinel_usecase.agent import ReferencePasswordSprayProposer
from sentinel_usecase.errors import UnsupportedUseCaseError
from sentinel_usecase.models import DetectionRequest, DetectionRuleProposal, ValidationState
from sentinel_usecase.workflow import UseCaseWorkflow


async def test_exact_v1_request_generates_explainable_valid_rule() -> None:
    rule = await UseCaseWorkflow(ReferencePasswordSprayProposer()).generate(
        DetectionRequest(requirement="Create a password spray detection")
    )
    assert rule.validation_status.state is ValidationState.PASSED
    assert rule.assumptions
    assert rule.potential_false_positives
    assert rule.enabled is False


async def test_out_of_scope_use_case_is_rejected_before_proposal() -> None:
    with pytest.raises(UnsupportedUseCaseError):
        await UseCaseWorkflow(ReferencePasswordSprayProposer()).generate(
            DetectionRequest(requirement="Create an impossible-travel detection")
        )


class RepairingProposer:
    def __init__(self, invalid: DetectionRuleProposal, repaired: DetectionRuleProposal) -> None:
        self._invalid = invalid
        self._repaired = repaired
        self.repair_calls = 0

    async def propose(self, request: DetectionRequest) -> DetectionRuleProposal:
        del request
        return self._invalid

    async def repair(
        self, request: DetectionRequest, validation_errors: tuple[str, ...]
    ) -> DetectionRuleProposal:
        del request
        assert validation_errors
        self.repair_calls += 1
        return self._repaired


async def test_invalid_llm_proposal_receives_one_bounded_repair_attempt() -> None:
    reference = ReferencePasswordSprayProposer()
    repaired = await reference.propose(
        DetectionRequest(requirement="Create a password spray detection")
    )
    invalid_payload = repaired.model_dump(mode="python")
    invalid_payload["query"] = repaired.query.replace(
        "DistinctAccountCount", "DistinctUsers"
    ).replace(
        "| mv-expand TargetAccount = TargetAccounts to typeof(string)\n", "")
    invalid = DetectionRuleProposal.model_validate(invalid_payload)
    proposer = RepairingProposer(invalid, repaired)

    rule = await UseCaseWorkflow(proposer).generate(
        DetectionRequest(requirement="Create a password spray detection")
    )
    assert proposer.repair_calls == 1
    assert rule.validation_status.state is ValidationState.PASSED
