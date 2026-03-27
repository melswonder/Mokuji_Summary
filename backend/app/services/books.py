from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.book import Book
from app.models.chapter import Chapter
from app.models.message import Message
from app.models.summary_snapshot import SummarySnapshot
from app.models.thread import Thread
from app.schemas.common import BookResponse, ChapterResponse, MessageResponse, SummaryResponse, ThreadResponse
from app.services.extractors.base import ExtractedBook


def book_to_dict(book: Book) -> dict:
    return {
        "source_url": book.source_url,
        "normalized_url": book.normalized_url,
        "title": book.title,
        "cover_image_url": book.cover_image_url,
        "authors": book.authors,
        "toc_entries": book.toc_entries,
        "chapters": [
            {
                "id": str(chapter.id),
                "chapter_key": chapter.chapter_key,
                "title": chapter.title,
                "part_title": chapter.part_title,
                "toc_entries": chapter.toc_entries,
            }
            for chapter in sorted(book.chapters, key=lambda item: item.sort_order)
            if not chapter.is_archived
        ],
    }


def upsert_book(db: Session, extracted: ExtractedBook) -> Book:
    book = db.scalar(
        select(Book)
        .options(selectinload(Book.chapters), selectinload(Book.summaries))
        .where(Book.normalized_url == extracted.normalized_url)
    )
    if not book:
        book = Book(normalized_url=extracted.normalized_url)
        db.add(book)

    book.source_url = extracted.source_url
    book.source_site = extracted.source_site
    book.title = extracted.title
    book.cover_image_url = extracted.cover_image_url
    book.authors = extracted.authors
    book.page_title = extracted.page_title
    book.toc_entries = extracted.toc_entries
    book.extraction_notes = extracted.extraction_notes
    book.toc_entry_count = len(extracted.toc_entries)

    existing = {chapter.chapter_key: chapter for chapter in book.chapters}
    active_keys = {chapter.chapter_key for chapter in extracted.chapters}

    for chapter in book.chapters:
        chapter.is_archived = chapter.chapter_key not in active_keys

    for extracted_chapter in extracted.chapters:
        chapter = existing.get(extracted_chapter.chapter_key)
        if not chapter:
            chapter = Chapter(book=book, chapter_key=extracted_chapter.chapter_key)
            db.add(chapter)
        chapter.sort_order = extracted_chapter.sort_order
        chapter.title = extracted_chapter.title
        chapter.part_title = extracted_chapter.part_title
        chapter.toc_entries = extracted_chapter.toc_entries
        chapter.is_archived = False

    db.commit()
    return get_book(db, book.id)


def _as_uuid(value: UUID | str) -> UUID:
    return value if isinstance(value, UUID) else UUID(str(value))


def get_book(db: Session, book_id: UUID | str) -> Book:
    book = db.scalar(
        select(Book)
        .options(
            selectinload(Book.chapters),
            selectinload(Book.summaries),
        )
        .where(Book.id == _as_uuid(book_id))
    )
    if not book:
        raise RuntimeError("Book not found")
    return book


def serialize_book(book: Book) -> BookResponse:
    chapters = sorted(book.chapters, key=lambda item: item.sort_order)
    summaries = sorted(book.summaries, key=lambda item: item.provider_id)
    return BookResponse(
        id=book.id,
        source_url=book.source_url,
        normalized_url=book.normalized_url,
        source_site=book.source_site,
        title=book.title,
        cover_image_url=book.cover_image_url,
        authors=book.authors,
        page_title=book.page_title,
        extraction_notes=book.extraction_notes,
        toc_entries=book.toc_entries,
        toc_entry_count=book.toc_entry_count,
        chapters=[
            ChapterResponse(
                id=chapter.id,
                chapter_key=chapter.chapter_key,
                sort_order=chapter.sort_order,
                title=chapter.title,
                part_title=chapter.part_title,
                toc_entries=chapter.toc_entries,
                is_archived=chapter.is_archived,
            )
            for chapter in chapters
        ],
        summaries=[
            SummaryResponse(
                provider_id=item.provider_id,
                summary=item.summary,
                key_topics=item.key_topics,
                target_audience=item.target_audience,
                confidence=item.confidence,
                evidence=item.evidence,
                limitations=item.limitations,
                updated_at=item.updated_at,
            )
            for item in summaries
        ],
    )


def list_books(db: Session) -> list[Book]:
    return list(
        db.scalars(
            select(Book)
            .options(joinedload(Book.chapters), selectinload(Book.summaries))
            .order_by(Book.updated_at.desc())
        ).unique()
    )


def delete_book(db: Session, book_id: UUID | str) -> None:
    book = get_book(db, book_id)
    db.delete(book)
    db.commit()


def get_or_create_thread(
    db: Session,
    book_id: UUID | str,
    chapter_id: UUID | str,
    provider_id: str,
) -> Thread:
    thread = db.scalar(
        select(Thread)
        .options(selectinload(Thread.messages))
        .where(
            Thread.book_id == _as_uuid(book_id),
            Thread.chapter_id == _as_uuid(chapter_id),
            Thread.provider_id == provider_id,
        )
    )
    if thread:
        return thread
    thread = Thread(
        book_id=_as_uuid(book_id),
        chapter_id=_as_uuid(chapter_id),
        provider_id=provider_id,
    )
    db.add(thread)
    db.commit()
    db.refresh(thread)
    return db.scalar(select(Thread).options(selectinload(Thread.messages)).where(Thread.id == thread.id))


def serialize_thread(thread: Thread) -> ThreadResponse:
    return ThreadResponse(
        id=thread.id,
        provider_id=thread.provider_id,
        chapter_id=thread.chapter_id,
        messages=[
            MessageResponse(
                id=message.id,
                role=message.role,
                content=message.content,
                created_at=message.created_at,
            )
            for message in sorted(thread.messages, key=lambda item: item.created_at)
        ],
    )


def append_message(db: Session, thread: Thread, role: str, content: str) -> Thread:
    db.add(Message(thread_id=thread.id, role=role, content=content))
    db.commit()
    return db.scalar(select(Thread).options(selectinload(Thread.messages)).where(Thread.id == thread.id))


def save_summary(db: Session, book: Book, provider_id: str, payload: dict) -> SummarySnapshot:
    snapshot = db.scalar(
        select(SummarySnapshot).where(
            SummarySnapshot.book_id == book.id,
            SummarySnapshot.provider_id == provider_id,
        )
    )
    if not snapshot:
        snapshot = SummarySnapshot(book_id=book.id, provider_id=provider_id)
        db.add(snapshot)
    snapshot.summary = payload["summary"]
    snapshot.key_topics = payload["keyTopics"]
    snapshot.target_audience = payload["targetAudience"]
    snapshot.confidence = payload["confidence"]
    snapshot.evidence = payload["evidence"]
    snapshot.limitations = payload["limitations"]
    db.commit()
    db.refresh(snapshot)
    return snapshot
