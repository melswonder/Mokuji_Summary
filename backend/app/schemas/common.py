from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ProviderStatusResponse(BaseModel):
    id: str
    name: str
    kind: str
    available: bool
    logged_in: bool
    detail: str
    connected_account: str | None = None


class SessionResponse(BaseModel):
    id: str | None = None
    google_connected: bool
    user: dict[str, str | None] | None = None


class ChapterResponse(BaseModel):
    id: UUID
    chapter_key: str
    sort_order: int
    title: str
    part_title: str | None = None
    toc_entries: list[str]
    is_archived: bool = False


class SummaryResponse(BaseModel):
    provider_id: str
    summary: str
    key_topics: list[str]
    target_audience: list[str]
    confidence: str
    evidence: list[str]
    limitations: list[str]
    updated_at: datetime | None = None


class BookResponse(BaseModel):
    id: UUID
    source_url: str
    normalized_url: str
    source_site: str
    title: str
    cover_image_url: str | None = None
    authors: list[str]
    page_title: str | None = None
    extraction_notes: list[str]
    toc_entries: list[str]
    toc_entry_count: int
    chapters: list[ChapterResponse]
    summaries: list[SummaryResponse]


class MessageResponse(BaseModel):
    id: UUID
    role: str
    content: str
    created_at: datetime


class ThreadResponse(BaseModel):
    id: UUID
    provider_id: str
    chapter_id: UUID
    messages: list[MessageResponse]
