from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class RetryPolicy:
    max_attempts: int = 3
    base_backoff_seconds: float = 0.5
    max_backoff_seconds: float = 8.0


@dataclass(frozen=True)
class TermsPolicy:
    prohibited_domains: tuple[str, ...] = ()
    allowed_domains: tuple[str, ...] = ()

    def is_domain_allowed(self, domain: str) -> bool:
        if domain in self.prohibited_domains:
            return False
        if self.allowed_domains:
            return domain in self.allowed_domains
        return True

    @classmethod
    def from_iterables(
        cls,
        prohibited_domains: Iterable[str] | None = None,
        allowed_domains: Iterable[str] | None = None,
    ) -> "TermsPolicy":
        return cls(
            prohibited_domains=tuple(prohibited_domains or ()),
            allowed_domains=tuple(allowed_domains or ()),
        )


@dataclass(frozen=True)
class SourcePolicy:
    name: str
    user_agent: str
    rate_limit_per_minute: int
    retry_policy: RetryPolicy
    terms_policy: TermsPolicy
