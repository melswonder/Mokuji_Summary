from pydantic import BaseModel


class ApiSettingsPayload(BaseModel):
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""
    google_cloud_project_id: str = ""
    gemini_model: str = ""


class CliSettingsPayload(BaseModel):
    codex_command: str = ""
    codex_model: str = ""
    claude_command: str = ""
    claude_model: str = ""


class SettingsResponse(BaseModel):
    api: dict[str, str]
    cli: CliSettingsPayload


class SettingsUpdate(BaseModel):
    api: ApiSettingsPayload | None = None
    cli: CliSettingsPayload | None = None
