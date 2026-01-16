from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class MetricsSnapshot:
    successes: int
    failures: int
    retries: int
    last_failure_at: datetime | None
    last_failure_reason: str | None


@dataclass
class MetricsRecorder:
    successes: int = 0
    failures: int = 0
    retries: int = 0
    last_failure_at: datetime | None = None
    last_failure_reason: str | None = None
    _failure_log: list[tuple[datetime, str]] = field(default_factory=list)

    def record_success(self) -> None:
        self.successes += 1

    def record_retry(self) -> None:
        self.retries += 1

    def record_failure(self, reason: str) -> None:
        self.failures += 1
        self.last_failure_at = datetime.now(timezone.utc)
        self.last_failure_reason = reason
        self._failure_log.append((self.last_failure_at, reason))

    def snapshot(self) -> MetricsSnapshot:
        return MetricsSnapshot(
            successes=self.successes,
            failures=self.failures,
            retries=self.retries,
            last_failure_at=self.last_failure_at,
            last_failure_reason=self.last_failure_reason,
        )

    @property
    def failure_log(self) -> tuple[tuple[datetime, str], ...]:
        return tuple(self._failure_log)
