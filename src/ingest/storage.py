from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin


@dataclass(frozen=True)
class StorageConfig:
    backend: str
    base_path: str
    public_base_url: Optional[str] = None


def build_pdf_storage_path(storage: StorageConfig, paper_id: str) -> str:
    safe_id = paper_id.replace("/", "_")
    if storage.backend == "local":
        return str(Path(storage.base_path) / f"{safe_id}.pdf")
    if storage.backend == "object":
        return f"{storage.base_path.rstrip('/')}/{safe_id}.pdf"
    raise ValueError(f"Unsupported storage backend: {storage.backend}")


def build_pdf_reference(storage: StorageConfig, stored_path: str) -> str:
    if storage.backend == "local":
        return stored_path
    if storage.backend == "object":
        if storage.public_base_url:
            return urljoin(storage.public_base_url.rstrip("/") + "/", stored_path.split("/")[-1])
        return stored_path
    raise ValueError(f"Unsupported storage backend: {storage.backend}")
