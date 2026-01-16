from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from enum import Enum
from typing import Iterable, Optional

from .schema import PaperMetadata


class SourceType(str, Enum):
    ARXIV = "arxiv"
    CROSSREF = "crossref"
    SEMANTIC_SCHOLAR = "semantic_scholar"


@dataclass(frozen=True)
class SourceConfig:
    source_type: SourceType
    base_url: str
    rate_limit_per_minute: int


@dataclass(frozen=True)
class QueryParams:
    keyword: Optional[str] = None
    category: Optional[str] = None
    published_after: Optional[date] = None


def default_sources() -> tuple[SourceConfig, ...]:
    return (
        SourceConfig(
            source_type=SourceType.ARXIV,
            base_url="https://export.arxiv.org/api/query",
            rate_limit_per_minute=20,
        ),
        SourceConfig(
            source_type=SourceType.CROSSREF,
            base_url="https://api.crossref.org/works",
            rate_limit_per_minute=50,
        ),
        SourceConfig(
            source_type=SourceType.SEMANTIC_SCHOLAR,
            base_url="https://api.semanticscholar.org/graph/v1",
            rate_limit_per_minute=30,
        ),
    )


def build_query_params(params: QueryParams) -> dict[str, str]:
    payload: dict[str, str] = {}
    if params.keyword:
        payload["keyword"] = params.keyword
    if params.category:
        payload["category"] = params.category
    if params.published_after:
        payload["published_after"] = params.published_after.isoformat()
    return payload


def normalize_text(text: str) -> str:
    return " ".join(text.lower().strip().split())


def _create_fallback_key(item: PaperMetadata) -> str:
    """Create a deduplication key from title, authors, and published date."""
    return "|".join(
        [
            normalize_text(item.title),
            normalize_text(" ".join(item.authors)),
            item.published_date.isoformat(),
        ]
    )


def _get_dedup_key(item: PaperMetadata) -> tuple[str, str]:
    """
    Get the deduplication key for a paper item.

    Returns a tuple of (key_type, key_value) where:
    - key_type is either "doi" or "fallback"
    - key_value is the normalized key string
    """
    if item.doi:
        return ("doi", item.doi.lower().strip())
    return ("fallback", _create_fallback_key(item))


def dedupe_metadata(items: Iterable[PaperMetadata]) -> list[PaperMetadata]:
    """Remove duplicate papers using DOI when available, falling back to title/authors/date."""
    seen_keys: dict[str, set[str]] = {"doi": set(), "fallback": set()}
    deduped: list[PaperMetadata] = []

    for item in items:
        key_type, key_value = _get_dedup_key(item)

        if key_value in seen_keys[key_type]:
            continue

        seen_keys[key_type].add(key_value)
        deduped.append(item)

    return deduped
