from datetime import UTC, datetime
from enum import StrEnum

from pydantic import Field

from sentinel_usecase.models.base import StrictModel


class ApprovalDecision(StrEnum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"


class HumanApproval(StrictModel):
    """Auditable, explicit human decision. Only APPROVE permits deployment."""

    decision: ApprovalDecision
    reviewer: str = Field(min_length=2, max_length=200)
    reviewed_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
