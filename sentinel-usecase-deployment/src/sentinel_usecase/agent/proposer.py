from typing import Protocol

from sentinel_usecase.models import DetectionRequest, DetectionRuleProposal


class RuleProposer(Protocol):
    """Narrow boundary: a proposer may propose, but may never validate or deploy."""

    async def propose(self, request: DetectionRequest) -> DetectionRuleProposal: ...
