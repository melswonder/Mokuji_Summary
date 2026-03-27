import uuid
from datetime import datetime

from sqlalchemy import DateTime, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Book(Base):
    __tablename__ = "books"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_url: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    source_site: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    cover_image_url: Mapped[str | None] = mapped_column(Text)
    authors: Mapped[list[str]] = mapped_column(JSON, default=list)
    page_title: Mapped[str | None] = mapped_column(Text)
    toc_entries: Mapped[list[str]] = mapped_column(JSON, default=list)
    extraction_notes: Mapped[list[str]] = mapped_column(JSON, default=list)
    toc_entry_count: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    chapters = relationship("Chapter", back_populates="book", cascade="all, delete-orphan")
    threads = relationship("Thread", back_populates="book", cascade="all, delete-orphan")
    summaries = relationship(
        "SummarySnapshot",
        back_populates="book",
        cascade="all, delete-orphan",
    )
