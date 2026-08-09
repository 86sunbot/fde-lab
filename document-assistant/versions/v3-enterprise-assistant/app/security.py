import asyncio
import hashlib
import math
import secrets
import time
from collections import defaultdict, deque
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class RateLimitDecision:
    allowed: bool
    retry_after_seconds: int = 0


class InMemoryRateLimiter:
    """Fixed-scope sliding-window limiter for one API process."""

    def __init__(self, request_limit: int, window_seconds: int) -> None:
        self._request_limit = request_limit
        self._window_seconds = window_seconds
        self._requests: dict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def check(self, client_id: str) -> RateLimitDecision:
        now = time.monotonic()
        window_start = now - self._window_seconds

        async with self._lock:
            timestamps = self._requests[client_id]
            while timestamps and timestamps[0] <= window_start:
                timestamps.popleft()

            if len(timestamps) >= self._request_limit:
                retry_after = math.ceil(self._window_seconds - (now - timestamps[0]))
                return RateLimitDecision(False, max(1, retry_after))

            timestamps.append(now)
            return RateLimitDecision(True)


async def require_api_key(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A bearer API key is required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    expected_key = request.app.state.settings.app_api_key.get_secret_value()
    if not secrets.compare_digest(credentials.credentials, expected_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return hashlib.sha256(credentials.credentials.encode("utf-8")).hexdigest()[:16]


async def enforce_rate_limit(
    request: Request,
    client_id: str = Depends(require_api_key),
) -> None:
    decision = await request.app.state.rate_limiter.check(client_id)
    if decision.allowed:
        return

    request.app.state.metrics.record_rate_limited()
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Rate limit exceeded",
        headers={"Retry-After": str(decision.retry_after_seconds)},
    )
