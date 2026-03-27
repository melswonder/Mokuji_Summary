from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.books import InspectRequest, SendMessageRequest, SummaryRequest
from app.schemas.common import SessionResponse
from app.schemas.settings import SettingsUpdate
from app.services import books as book_service
from app.services.extractors.base import UnsupportedSourceError
from app.services.extractors.service import inspect_url
from app.services.providers import gemini
from app.services.providers.registry import chat as provider_chat
from app.services.providers.registry import list_statuses, summarize as provider_summarize
from app.services.session import attach_session_cookie, ensure_session
from app.services.settings import get_effective_settings, save_settings


router = APIRouter()


@router.get("/health")
def healthcheck() -> dict:
    return {"ok": True}


@router.get("/session")
def get_session(request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    session = ensure_session(request, db)
    payload = SessionResponse(
        id=session.id,
        google_connected=bool(session.google_access_token),
        user={
            "email": session.google_email,
            "name": session.google_name,
            "picture": session.google_picture,
        }
        if session.google_access_token
        else None,
    )
    attach_session_cookie(response, session)
    return {"session": payload.model_dump(), "oauth": {"google_configured": gemini.is_configured()}}


@router.get("/providers")
async def providers(request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    session = ensure_session(request, db)
    attach_session_cookie(response, session)
    return {"providers": await list_statuses(session)}


@router.get("/settings")
def get_settings_route() -> dict:
    return {"settings": get_effective_settings()}


@router.put("/settings")
def put_settings(update: SettingsUpdate) -> dict:
    return {"settings": save_settings(update)}


@router.get("/auth/google/start")
def google_start(
    request: Request,
    response: Response,
    redirect_path: str = Query("/"),
    db: Session = Depends(get_db),
) -> RedirectResponse:
    session = ensure_session(request, db)
    auth_url = gemini.build_auth_url(session, redirect_path)
    db.commit()
    redirect = RedirectResponse(auth_url)
    attach_session_cookie(redirect, session)
    return redirect


@router.get("/auth/google/callback")
async def google_callback(
    request: Request,
    code: str,
    state: str,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    session = ensure_session(request, db)
    try:
        redirect_path = await gemini.handle_callback(session, code, state)
        db.commit()
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    redirect = RedirectResponse(redirect_path)
    attach_session_cookie(redirect, session)
    return redirect


@router.post("/auth/google/disconnect")
async def google_disconnect(request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    session = ensure_session(request, db)
    await gemini.disconnect(session)
    db.commit()
    attach_session_cookie(response, session)
    return {"ok": True}


@router.post("/books/inspect")
async def inspect_book(request: Request, response: Response, payload: InspectRequest, db: Session = Depends(get_db)) -> dict:
    session = ensure_session(request, db)
    try:
        extracted = await inspect_url(str(payload.url))
    except UnsupportedSourceError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    book = book_service.upsert_book(db, extracted)
    attach_session_cookie(response, session)
    return {"book": book_service.serialize_book(book)}


@router.get("/books")
def list_books(request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    session = ensure_session(request, db)
    attach_session_cookie(response, session)
    return {"books": [book_service.serialize_book(book) for book in book_service.list_books(db)]}


@router.get("/books/{book_id}")
def get_book(book_id: str, request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    session = ensure_session(request, db)
    try:
        book = book_service.get_book(db, book_id)
    except Exception as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    attach_session_cookie(response, session)
    return {"book": book_service.serialize_book(book)}


@router.delete("/books/{book_id}")
def delete_book(book_id: str, request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    session = ensure_session(request, db)
    try:
        book_service.delete_book(db, book_id)
    except Exception as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    attach_session_cookie(response, session)
    return {"ok": True}


@router.get("/books/{book_id}/threads")
def get_thread(
    book_id: str,
    chapter_id: str,
    provider_id: str,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict:
    session = ensure_session(request, db)
    try:
        thread = book_service.get_or_create_thread(db, book_id, chapter_id, provider_id)
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    attach_session_cookie(response, session)
    return {"thread": book_service.serialize_thread(thread)}


@router.post("/books/{book_id}/threads/messages")
async def send_message(
    book_id: str,
    payload: SendMessageRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict:
    session = ensure_session(request, db)
    try:
        book = book_service.get_book(db, book_id)
        thread = book_service.get_or_create_thread(db, book.id, payload.chapter_id, payload.provider_id)
        thread = book_service.append_message(db, thread, "user", payload.content)
        chapter = next((item for item in book.chapters if str(item.id) == str(payload.chapter_id)), None)
        if not chapter:
            raise RuntimeError("章が見つかりません。")
        answer = await provider_chat(
            payload.provider_id,
            book_service.book_to_dict(book),
            {
                "id": str(chapter.id),
                "title": chapter.title,
                "part_title": chapter.part_title,
                "toc_entries": chapter.toc_entries,
            },
            [{"role": message.role, "content": message.content} for message in thread.messages],
            session,
        )
        thread = book_service.append_message(db, thread, "assistant", answer)
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    attach_session_cookie(response, session)
    return {"thread": book_service.serialize_thread(thread)}


@router.post("/books/{book_id}/summary")
async def generate_summary(
    book_id: str,
    payload: SummaryRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict:
    session = ensure_session(request, db)
    try:
        book = book_service.get_book(db, book_id)
        summary = await provider_summarize(payload.provider_id, book_service.book_to_dict(book), session)
        snapshot = book_service.save_summary(db, book, payload.provider_id, summary)
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    attach_session_cookie(response, session)
    return {
        "summary": {
            "provider_id": snapshot.provider_id,
            "summary": snapshot.summary,
            "key_topics": snapshot.key_topics,
            "target_audience": snapshot.target_audience,
            "confidence": snapshot.confidence,
            "evidence": snapshot.evidence,
            "limitations": snapshot.limitations,
            "updated_at": snapshot.updated_at,
        }
    }
