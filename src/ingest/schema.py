from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Iterable, Optional


@dataclass(frozen=True)
class PaperMetadata:
    title: str
    authors: tuple[str, ...]
    abstract: str
    doi: Optional[str]
    published_date: date
    pdf_url: Optional[str]
    source: str
    source_id: str
    keywords: tuple[str, ...] = field(default_factory=tuple)


SQL_PAPERS_SCHEMA = """
CREATE TABLE IF NOT EXISTS papers (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    authors TEXT NOT NULL,
    abstract TEXT NOT NULL,
    doi TEXT,
    published_date TEXT NOT NULL,
    pdf_url TEXT,
    source TEXT NOT NULL,
    source_id TEXT NOT NULL,
    keywords TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_papers_doi ON papers(doi);
CREATE UNIQUE INDEX IF NOT EXISTS idx_papers_source ON papers(source, source_id);
"""


def serialize_authors(authors: Iterable[str]) -> str:
    return "|".join(author.strip() for author in authors)


def serialize_keywords(keywords: Iterable[str]) -> str:
    return "|".join(keyword.strip() for keyword in keywords)
