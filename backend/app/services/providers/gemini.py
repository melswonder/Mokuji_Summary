from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe
from urllib.parse import urlencode

import httpx

from app.core.config import get_settings
from app.models.app_session import AppSession
from app.services.prompts import build_chat_prompt, build_summary_prompt
from app.services.providers.base import ProviderStatus, unavailable_status
from app.services.providers.shared import parse_summary_json
from app.services.settings import get_runtime_api_secret


settings = get_settings()


def is_configured() -> bool:
    return bool(
        get_runtime_api_secret("google_client_id")
        and get_runtime_api_secret("google_client_secret")
        and (get_runtime_api_secret("google_redirect_uri") or settings.google_redirect_uri)
        and (get_runtime_api_secret("google_cloud_project_id") or settings.google_cloud_project_id)
    )


async def get_status(session: AppSession | None) -> ProviderStatus:
    if not is_configured():
        return unavailable_status(
            "gemini",
            "Gemini API",
            "api",
            "Google OAuth 設定が未入力です。",
        )
    return ProviderStatus(
        id="gemini",
        name="Gemini API",
        kind="api",
        available=True,
        logged_in=bool(session and session.google_access_token),
        detail="Google OAuth で接続済み。" if session and session.google_access_token else "Google OAuth で接続してください。",
        connected_account=session.google_email if session else None,
    )


def build_auth_url(session: AppSession, redirect_path: str | None) -> str:
    state = token_urlsafe(24)
    session.oauth_state = state
    session.oauth_redirect_path = redirect_path or "/"
    query = urlencode(
        {
            "client_id": get_runtime_api_secret("google_client_id"),
            "redirect_uri": get_runtime_api_secret("google_redirect_uri") or settings.google_redirect_uri,
            "response_type": "code",
            "scope": "openid email profile https://www.googleapis.com/auth/generative-language.retriever",
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
    )
    return f"https://accounts.google.com/o/oauth2/v2/auth?{query}"


async def handle_callback(session: AppSession, code: str, state: str) -> str:
    if session.oauth_state != state:
        raise RuntimeError("OAuth state が一致しません。")

    async with httpx.AsyncClient(timeout=20.0) as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": get_runtime_api_secret("google_client_id"),
                "client_secret": get_runtime_api_secret("google_client_secret"),
                "redirect_uri": get_runtime_api_secret("google_redirect_uri") or settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        token_response.raise_for_status()
        token_payload = token_response.json()

        access_token = token_payload["access_token"]
        session.google_access_token = access_token
        session.google_refresh_token = token_payload.get("refresh_token")
        session.google_scope = token_payload.get("scope")
        session.google_expiry_date = datetime.now(timezone.utc) + timedelta(
            seconds=int(token_payload.get("expires_in", 3600))
        )

        user_info = await client.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={"authorization": f"Bearer {access_token}"},
        )
        user_info.raise_for_status()
        payload = user_info.json()
        session.google_email = payload.get("email")
        session.google_name = payload.get("name")
        session.google_picture = payload.get("picture")

    redirect_path = session.oauth_redirect_path or "/"
    session.oauth_state = None
    session.oauth_redirect_path = None
    return redirect_path


async def disconnect(session: AppSession) -> None:
    session.google_access_token = None
    session.google_refresh_token = None
    session.google_expiry_date = None
    session.google_scope = None
    session.google_email = None
    session.google_name = None
    session.google_picture = None


async def ensure_access_token(session: AppSession) -> str:
    if not session.google_access_token:
        raise RuntimeError("Google OAuth で接続してください。")

    if session.google_expiry_date and session.google_expiry_date > datetime.now(timezone.utc) + timedelta(minutes=5):
        return session.google_access_token

    if not session.google_refresh_token:
        return session.google_access_token

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": get_runtime_api_secret("google_client_id"),
                "client_secret": get_runtime_api_secret("google_client_secret"),
                "grant_type": "refresh_token",
                "refresh_token": session.google_refresh_token,
            },
        )
        response.raise_for_status()
        payload = response.json()
        session.google_access_token = payload["access_token"]
        session.google_expiry_date = datetime.now(timezone.utc) + timedelta(
            seconds=int(payload.get("expires_in", 3600))
        )
        return session.google_access_token


async def _generate_content(prompt: str, session: AppSession) -> str:
    access_token = await ensure_access_token(session)
    model = get_effective_model()
    project_id = get_runtime_api_secret("google_cloud_project_id") or settings.google_cloud_project_id
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            headers={
                "authorization": f"Bearer {access_token}",
                "content-type": "application/json",
                "x-goog-user-project": project_id,
            },
            json={
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": prompt}],
                    }
                ],
                "generationConfig": {
                    "temperature": 0.2,
                },
            },
        )
        response.raise_for_status()
        payload = response.json()
        for candidate in payload.get("candidates", []):
            for part in candidate.get("content", {}).get("parts", []):
                text = part.get("text")
                if isinstance(text, str) and text.strip():
                    return text.strip()
    raise RuntimeError("Gemini API の応答からテキストを取得できませんでした。")


def get_effective_model() -> str:
    from app.services.settings import get_effective_settings

    return get_effective_settings()["api"]["gemini_model"] or settings.gemini_model


async def summarize(book: dict, session: AppSession) -> dict:
    text = await _generate_content(build_summary_prompt(book), session)
    return parse_summary_json(text)


async def chat(book: dict, chapter: dict, messages: list[dict], session: AppSession) -> str:
    return await _generate_content(build_chat_prompt(book, chapter, messages), session)
