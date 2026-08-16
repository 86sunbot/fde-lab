"""Expected application errors used by the fail-closed workflow."""


class SentinelUseCaseError(Exception):
    """Base class for expected application errors."""


class ConfigurationError(SentinelUseCaseError):
    """Raised when required local configuration is unavailable or invalid."""


class UnsupportedUseCaseError(SentinelUseCaseError):
    """Raised when the request is outside the password-spray-only V1 scope."""


class ProposalError(SentinelUseCaseError):
    """Raised when the LLM cannot provide a typed proposal."""


class RuleValidationError(SentinelUseCaseError):
    """Raised when deterministic rule validation fails."""


class ApprovalRequiredError(SentinelUseCaseError):
    """Raised when deployment does not have an explicit human approval."""


class DeploymentUnavailableError(SentinelUseCaseError):
    """Raised when the existing deployment script or its adapter is unavailable."""


class DeploymentExecutionError(SentinelUseCaseError):
    """Raised when the approved PowerShell deployment command fails."""
