import json
from pathlib import Path

from app.core.config import get_settings
from app.schemas.settings import SettingsUpdate


settings = get_settings()


def _read_file_settings() -> dict:
    path = settings.settings_file
    if not path.exists():
        return {
            "api": {},
            "cli": {},
        }
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"api": {}, "cli": {}}


def get_effective_settings() -> dict:
    stored = _read_file_settings()
    return {
        "api": {
            "google_client_id": stored.get("api", {}).get("google_client_id") or settings.google_client_id,
            "google_client_secret": stored.get("api", {}).get("google_client_secret")
            or settings.google_client_secret,
            "google_redirect_uri": stored.get("api", {}).get("google_redirect_uri") or settings.google_redirect_uri,
            "google_cloud_project_id": stored.get("api", {}).get("google_cloud_project_id")
            or settings.google_cloud_project_id,
            "gemini_model": stored.get("api", {}).get("gemini_model") or settings.gemini_model,
        },
        "cli": {
            "codex_command": stored.get("cli", {}).get("codex_command") or settings.codex_command,
            "codex_model": stored.get("cli", {}).get("codex_model") or settings.codex_model,
            "claude_command": stored.get("cli", {}).get("claude_command") or settings.claude_command,
            "claude_model": stored.get("cli", {}).get("claude_model") or settings.claude_model,
        },
    }


def get_runtime_api_secret(name: str) -> str:
    stored = _read_file_settings()
    return stored.get("api", {}).get(name) or getattr(settings, name)


def save_settings(update: SettingsUpdate) -> dict:
    current = _read_file_settings()
    merged = {
        "api": {
            **current.get("api", {}),
            **(update.api.model_dump(exclude_none=True) if update.api else {}),
        },
        "cli": {
            **current.get("cli", {}),
            **(update.cli.model_dump(exclude_none=True) if update.cli else {}),
        },
    }
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.settings_file.write_text(
        json.dumps(merged, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return get_effective_settings()
