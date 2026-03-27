import json
from pathlib import Path
from tempfile import TemporaryDirectory

from app.services.prompts import SUMMARY_SCHEMA, build_chat_prompt, build_summary_prompt
from app.services.providers.base import ProviderStatus, unavailable_status
from app.services.providers.shared import parse_summary_json, run_command
from app.services.settings import get_effective_settings


async def get_status() -> ProviderStatus:
    settings = get_effective_settings()
    command = settings["cli"]["codex_command"] or "codex"
    try:
        stdout, stderr = await run_command(command, "login", "status", timeout=10)
    except FileNotFoundError:
        return unavailable_status("codex", "Codex", "cli", f"`{command}` CLI が見つかりません。")
    except Exception as error:
        return unavailable_status("codex", "Codex", "cli", f"状態確認に失敗しました: {error}")

    text = f"{stdout}\n{stderr}"
    logged_in = "logged in" in text.lower()
    return ProviderStatus(
        id="codex",
        name="Codex",
        kind="cli",
        available=True,
        logged_in=logged_in,
        detail=text.strip() if logged_in else f"未ログイン。`{command} login` が必要です。",
    )


async def summarize(book: dict) -> dict:
    status = await get_status()
    if not status.available or not status.logged_in:
        raise RuntimeError(status.detail)
    settings = get_effective_settings()
    command = settings["cli"]["codex_command"] or "codex"
    model = settings["cli"]["codex_model"]
    with TemporaryDirectory(prefix="mokuji-codex-") as temp_dir:
        schema_path = Path(temp_dir) / "summary-schema.json"
        output_path = Path(temp_dir) / "summary-output.json"
        schema_path.write_text(json.dumps(SUMMARY_SCHEMA), encoding="utf-8")
        args = [
            "-a",
            "never",
            "exec",
            "--skip-git-repo-check",
            "--ephemeral",
            "--sandbox",
            "read-only",
            "--output-schema",
            str(schema_path),
            "--output-last-message",
            str(output_path),
            build_summary_prompt(book),
        ]
        if model:
            args[3:3] = ["-m", model]
        await run_command(command, *args, timeout=180)
        return parse_summary_json(output_path.read_text(encoding="utf-8").strip())


async def chat(book: dict, chapter: dict, messages: list[dict]) -> str:
    status = await get_status()
    if not status.available or not status.logged_in:
        raise RuntimeError(status.detail)
    settings = get_effective_settings()
    command = settings["cli"]["codex_command"] or "codex"
    model = settings["cli"]["codex_model"]
    with TemporaryDirectory(prefix="mokuji-codex-chat-") as temp_dir:
        output_path = Path(temp_dir) / "chat-output.txt"
        args = [
            "-a",
            "never",
            "exec",
            "--skip-git-repo-check",
            "--ephemeral",
            "--sandbox",
            "read-only",
            "--output-last-message",
            str(output_path),
            build_chat_prompt(book, chapter, messages),
        ]
        if model:
            args[3:3] = ["-m", model]
        await run_command(command, *args, timeout=180)
        return output_path.read_text(encoding="utf-8").strip()
