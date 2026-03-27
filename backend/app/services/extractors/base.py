from dataclasses import dataclass


@dataclass
class ExtractedChapter:
    chapter_key: str
    title: str
    sort_order: int
    part_title: str | None
    toc_entries: list[str]


@dataclass
class ExtractedBook:
    source_url: str
    normalized_url: str
    source_site: str
    title: str
    cover_image_url: str | None
    authors: list[str]
    page_title: str | None
    toc_entries: list[str]
    extraction_notes: list[str]
    chapters: list[ExtractedChapter]


class UnsupportedSourceError(ValueError):
    pass
