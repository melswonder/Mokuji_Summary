from fastapi import Request, Response
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.app_session import AppSession


settings = get_settings()


def ensure_session(request: Request, db: Session) -> AppSession:
    session_id = request.cookies.get(settings.session_cookie_name)
    session = db.get(AppSession, session_id) if session_id else None
    if session:
        return session

    session = AppSession()
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def attach_session_cookie(response: Response, session: AppSession) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=session.id,
        httponly=True,
        samesite="lax",
        secure=settings.session_secure,
        path="/",
    )
