from uuid import UUID

from pydantic import BaseModel, HttpUrl


class InspectRequest(BaseModel):
    url: HttpUrl
    provider_id: str = "gemini"


class SummaryRequest(BaseModel):
    provider_id: str = "gemini"


class SendMessageRequest(BaseModel):
    chapter_id: UUID
    provider_id: str
    content: str
