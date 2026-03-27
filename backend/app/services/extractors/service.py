from urllib.parse import urlparse

import httpx

from app.services.extractors.base import ExtractedBook, UnsupportedSourceError
from app.services.extractors.parser import extract_book, get_supported_source_label


async def inspect_url(url: str) -> ExtractedBook:
    hostname = urlparse(url).hostname or ""
    if not get_supported_source_label(hostname):
        raise UnsupportedSourceError(
            "未対応の URL です。対応ドメインは O'Reilly / 翔泳社 / 技術評論社 です。"
        )

    async with httpx.AsyncClient(follow_redirects=True, timeout=20.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        return extract_book(url, response.text)
