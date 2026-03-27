from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


DEFAULT_DATA_DIR = Path(__file__).resolve().parents[2] / "data"


class Settings(BaseSettings):
    app_name: str = "Mokuji Backend"
    environment: str = "development"
    frontend_origin: str = "http://localhost:3000"
    backend_public_url: str = "http://localhost:8000"
    database_url: str = f"sqlite:///{(DEFAULT_DATA_DIR / 'mokuji.db').as_posix()}"
    session_cookie_name: str = "mokuji_session"
    session_secure: bool = False
    data_dir: Path = Field(default=DEFAULT_DATA_DIR)
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""
    google_cloud_project_id: str = ""
    gemini_model: str = "gemini-2.5-flash"
    codex_command: str = "codex"
    codex_model: str = ""
    claude_command: str = "claude"
    claude_model: str = "sonnet"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def settings_file(self) -> Path:
        return self.data_dir / "app-settings.json"


@lru_cache
def get_settings() -> Settings:
    return Settings()
