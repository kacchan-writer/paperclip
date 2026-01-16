from __future__ import annotations

import time
from collections import defaultdict, deque
from dataclasses import dataclass


@dataclass
class RateLimitDecision:
    allowed: bool
    retry_after_seconds: float | None


class RateLimiter:
    """Simple sliding window rate limiter per source."""

    def __init__(self, window_seconds: int = 60) -> None:
        self._window_seconds = window_seconds
        self._events: dict[str, deque[float]] = defaultdict(deque)

    def check(self, source_name: str, rate_limit_per_minute: int) -> RateLimitDecision:
        now = time.monotonic()
        window_start = now - self._window_seconds
        events = self._events[source_name]
        while events and events[0] < window_start:
            events.popleft()
        if len(events) >= rate_limit_per_minute:
            retry_after = self._window_seconds - (now - events[0])
            return RateLimitDecision(False, max(retry_after, 0.0))
        events.append(now)
        return RateLimitDecision(True, None)
