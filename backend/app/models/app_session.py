import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AppSession(Base):
    __tablename__ = "app_sessions"

    id: Mapped[str] = mapped_column(String(128), primary_key=True, default=lambda: str(uuid.uuid4()))
    oauth_state: Mapped[str | None] = mapped_column(String(128))
    oauth_redirect_path: Mapped[str | None] = mapped_column(Text)
    google_access_token: Mapped[str | None] = mapped_column(Text)
    google_refresh_token: Mapped[str | None] = mapped_column(Text)
    google_expiry_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    google_scope: Mapped[str | None] = mapped_column(Text)
    google_email: Mapped[str | None] = mapped_column(Text)
    google_name: Mapped[str | None] = mapped_column(Text)
    google_picture: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
