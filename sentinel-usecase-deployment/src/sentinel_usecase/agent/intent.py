import re

from sentinel_usecase.errors import UnsupportedUseCaseError
from sentinel_usecase.models import DetectionRequest


def require_supported_password_spray_request(request: DetectionRequest) -> None:
    """Apply a deterministic V1 scope gate before spending an LLM request."""

    normalized = re.sub(r"[^a-z0-9]+", " ", request.requirement.casefold()).strip()
    password_spray = re.search(r"\bpassword\s+spray(?:ing)?\b", normalized)
    if password_spray is None:
        raise UnsupportedUseCaseError(
            "This offline reference currently generates only password-spray rules; "
            "general detection requests require the proposal service and broader rule templates."
        )
