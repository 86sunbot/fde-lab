import pytest

from sentinel_usecase.agent import ReferencePasswordSprayProposer
from sentinel_usecase.models import DetectionRequest, DetectionRule
from sentinel_usecase.validation import RuleValidator


@pytest.fixture
async def valid_rule() -> DetectionRule:
    proposal = await ReferencePasswordSprayProposer().propose(
        DetectionRequest(requirement="Create a password spray detection")
    )
    return RuleValidator().validate(DetectionRule.from_proposal(proposal))
