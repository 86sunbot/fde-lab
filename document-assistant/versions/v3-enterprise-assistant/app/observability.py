import json
import logging
from contextvars import ContextVar
from datetime import datetime, timezone
from threading import Lock
from typing import Any

request_id_context: ContextVar[str] = ContextVar("request_id", default="-")


class JsonFormatter(logging.Formatter):
    """Render application logs as one JSON object per line."""

    EXTRA_FIELDS = (
        "method",
        "path",
        "status_code",
        "duration_ms",
        "document",
        "indexed_chunks",
    )

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": request_id_context.get(),
        }

        for field in self.EXTRA_FIELDS:
            if hasattr(record, field):
                payload[field] = getattr(record, field)

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, default=str)


def configure_logging(level: str) -> logging.Logger:
    logger = logging.getLogger("document_assistant")
    logger.setLevel(level.upper())
    logger.propagate = False

    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)

    return logger


class MetricsCollector:
    """Small per-process metrics store suitable for the single-instance V3 scope."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._total_requests = 0
        self._question_requests = 0
        self._error_responses = 0
        self._rate_limited_requests = 0
        self._active_requests = 0
        self._total_duration_ms = 0.0

    def record_start(self, path: str) -> None:
        with self._lock:
            self._total_requests += 1
            self._active_requests += 1
            if path == "/v1/questions":
                self._question_requests += 1

    def record_completion(self, status_code: int, duration_ms: float) -> None:
        with self._lock:
            self._active_requests = max(0, self._active_requests - 1)
            self._total_duration_ms += duration_ms
            if status_code >= 400:
                self._error_responses += 1

    def record_rate_limited(self) -> None:
        with self._lock:
            self._rate_limited_requests += 1

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            average_duration = (
                self._total_duration_ms / self._total_requests
                if self._total_requests
                else 0.0
            )
            return {
                "total_requests": self._total_requests,
                "question_requests": self._question_requests,
                "error_responses": self._error_responses,
                "rate_limited_requests": self._rate_limited_requests,
                "active_requests": self._active_requests,
                "average_duration_ms": round(average_duration, 2),
            }
