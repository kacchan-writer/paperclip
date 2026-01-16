from __future__ import annotations

import logging
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass

from paperclip.metrics import MetricsRecorder
from paperclip.policies import SourcePolicy
from paperclip.rate_limiter import RateLimiter
from paperclip.robots import RobotsComplianceChecker

logger = logging.getLogger(__name__)


@dataclass
class FetchResult:
    url: str
    status_code: int
    content: bytes


class FailureLogger:
    def __init__(self, path: str) -> None:
        self._path = path

    def log(self, message: str) -> None:
        with open(self._path, "a", encoding="utf-8") as handle:
            handle.write(message + "\n")


class Fetcher:
    def __init__(
        self,
        source_policies: dict[str, SourcePolicy],
        rate_limiter: RateLimiter | None = None,
        metrics: MetricsRecorder | None = None,
        failure_logger: FailureLogger | None = None,
    ) -> None:
        self._source_policies = source_policies
        self._rate_limiter = rate_limiter or RateLimiter()
        self._metrics = metrics or MetricsRecorder()
        self._failure_logger = failure_logger
        self._robots_checkers: dict[str, RobotsComplianceChecker] = {}

    @property
    def metrics(self) -> MetricsRecorder:
        return self._metrics

    def fetch(self, url: str, source_name: str) -> FetchResult | None:
        policy = self._source_policies[source_name]
        parsed = urllib.parse.urlparse(url)
        domain = parsed.netloc
        if not policy.terms_policy.is_domain_allowed(domain):
            reason = f"Domain {domain} is prohibited by terms policy"
            self._record_failure(reason)
            return None

        robots_checker = self._robots_checkers.get(source_name)
        if robots_checker is None:
            robots_checker = RobotsComplianceChecker(policy.user_agent)
            self._robots_checkers[source_name] = robots_checker

        if not robots_checker.is_allowed(url):
            reason = f"Robots.txt disallows fetching {url}"
            self._record_failure(reason)
            return None

        decision = self._rate_limiter.check(source_name, policy.rate_limit_per_minute)
        if not decision.allowed:
            reason = (
                f"Rate limit exceeded for {source_name}, retry after "
                f"{decision.retry_after_seconds:.2f}s"
            )
            self._record_failure(reason)
            return None

        attempt = 0
        while attempt < policy.retry_policy.max_attempts:
            attempt += 1
            try:
                request = urllib.request.Request(url, headers={"User-Agent": policy.user_agent})
                with urllib.request.urlopen(request, timeout=15) as response:
                    content = response.read()
                    result = FetchResult(
                        url=url,
                        status_code=response.getcode() or 200,
                        content=content,
                    )
                self._metrics.record_success()
                return result
            except urllib.error.HTTPError as exc:
                status = exc.code
                reason = f"HTTP {status} for {url}"
                self._record_failure(reason)
                if 500 <= status < 600 and attempt < policy.retry_policy.max_attempts:
                    self._metrics.record_retry()
                    self._sleep_backoff(attempt, policy)
                    continue
                return None
            except Exception as exc:
                reason = f"Request failed for {url}: {exc}"
                self._record_failure(reason)
                if attempt < policy.retry_policy.max_attempts:
                    self._metrics.record_retry()
                    self._sleep_backoff(attempt, policy)
                    continue
                return None
        return None

    def _sleep_backoff(self, attempt: int, policy: SourcePolicy) -> None:
        backoff = min(
            policy.retry_policy.base_backoff_seconds * (2 ** (attempt - 1)),
            policy.retry_policy.max_backoff_seconds,
        )
        time.sleep(backoff)

    def _record_failure(self, reason: str) -> None:
        logger.warning(reason)
        self._metrics.record_failure(reason)
        if self._failure_logger:
            self._failure_logger.log(reason)
