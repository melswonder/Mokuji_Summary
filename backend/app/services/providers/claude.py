import json

from app.services.prompts import SUMMARY_SCHEMA, build_chat_prompt, build_summary_prompt
from app.services.providers.base import ProviderStatus, unavailable_status
from app.services.providers.shared import CommandFailure, parse_summary_json, run_command
from app.services.settings import get_effective_settings


async def get_status() -> ProviderStatus:
    settings = get_effective_settings()
    command = settings["cli"]["claude_command"] or "claude"
    try:
        stdout, _ = await run_command(command, "auth", "status", timeout=10)
        payload = json.loads(stdout)
        logged_in = bool(payload.get("loggedIn"))
        detail = (
            f"ログイン済み ({payload.get('authMethod', 'unknown')})"
            if logged_in
            else f"未ログイン。`{command} auth login` が必要です。"
        )
        return ProviderStatus(
            id="claude",
            name="Claude",
            kind="cli",
            available=True,
            logged_in=logged_in,
            detail=detail,
        )
    except FileNotFoundError:
        return unavailable_status("claude", "Claude", "cli", f"`{command}` CLI が見つかりません。")
    except CommandFailure as error:
        if error.stdout.strip().startswith("{"):
            payload = json.loads(error.stdout)
            logged_in = bool(payload.get("loggedIn"))
            return ProviderStatus(
                id="claude",
                name="Claude",
                kind="cli",
                available=True,
                logged_in=logged_in,
                detail="ログイン済み" if logged_in else f"未ログイン。`{command} auth login` が必要です。",
            )
        return unavailable_status("claude", "Claude", "cli", f"状態確認に失敗しました: {error}")
    except Exception as error:
        return unavailable_status("claude", "Claude", "cli", f"状態確認に失敗しました: {error}")


async def summarize(book: dict) -> dict:
    status = await get_status()
    if not status.available or not status.logged_in:
        raise RuntimeError(status.detail)
    settings = get_effective_settings()
    stdout, _ = await run_command(
        settings["cli"]["claude_command"] or "claude",
        "-p",
        "--json-schema",
        json.dumps(SUMMARY_SCHEMA),
        "--output-format",
        "text",
        "--model",
        settings["cli"]["claude_model"] or "sonnet",
        build_summary_prompt(book),
        timeout=120,
    )
    return parse_summary_json(stdout.strip())


async def chat(book: dict, chapter: dict, messages: list[dict]) -> str:
    status = await get_status()
    if not status.available or not status.logged_in:
        raise RuntimeError(status.detail)
    settings = get_effective_settings()
    stdout, _ = await run_command(
        settings["cli"]["claude_command"] or "claude",
        "-p",
        "--output-format",
        "text",
        "--model",
        settings["cli"]["claude_model"] or "sonnet",
        build_chat_prompt(book, chapter, messages),
        timeout=120,
    )
    return stdout.strip()
