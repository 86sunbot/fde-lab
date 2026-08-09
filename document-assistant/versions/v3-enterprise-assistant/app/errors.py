class DocumentAssistantError(Exception):
    """Base class for expected application errors."""


class DocumentProcessingError(DocumentAssistantError):
    """Raised when a document cannot be prepared for retrieval."""


class AssistantNotReadyError(DocumentAssistantError):
    """Raised when a question arrives before the document index is ready."""


class UpstreamServiceError(DocumentAssistantError):
    """Raised when an external AI request fails."""
