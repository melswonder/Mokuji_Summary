import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Chapter(Base):
    __tablename__ = "chapters"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    book_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"))
    chapter_key: Mapped[str] = mapped_column(String(128), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    part_title: Mapped[str | None] = mapped_column(Text)
    toc_entries: Mapped[list[str]] = mapped_column(JSON, default=list)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)

    book = relationship("Book", back_populates="chapters")
    threads = relationship("Thread", back_populates="chapter")
