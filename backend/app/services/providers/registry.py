from app.models.app_session import AppSession
from app.services.providers import claude, codex, gemini


async def list_statuses(session: AppSession | None) -> list[dict]:
    statuses = [
        await gemini.get_status(session),
        await codex.get_status(),
        await claude.get_status(),
    ]
    return [
        {
            "id": status.id,
            "name": status.name,
            "kind": status.kind,
            "available": status.available,
            "logged_in": status.logged_in,
            "detail": status.detail,
            "connected_account": status.connected_account,
        }
        for status in statuses
    ]


async def summarize(provider_id: str, book: dict, session: AppSession | None) -> dict:
    if provider_id == "gemini":
        if not session:
            raise RuntimeError("セッションがありません。")
        return await gemini.summarize(book, session)
    if provider_id == "codex":
        return await codex.summarize(book)
    if provider_id == "claude":
        return await claude.summarize(book)
    raise RuntimeError(f"Unknown provider: {provider_id}")


async def chat(provider_id: str, book: dict, chapter: dict, messages: list[dict], session: AppSession | None) -> str:
    if provider_id == "gemini":
        if not session:
            raise RuntimeError("セッションがありません。")
        return await gemini.chat(book, chapter, messages, session)
    if provider_id == "codex":
        return await codex.chat(book, chapter, messages)
    if provider_id == "claude":
        return await claude.chat(book, chapter, messages)
    raise RuntimeError(f"Unknown provider: {provider_id}")
