import json
import re
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from app.services.extractors.base import ExtractedBook, ExtractedChapter

SUPPORTED_DOMAINS = {
    "oreilly.com": "O'Reilly",
    "oreilly.co.jp": "O'Reilly Japan",
    "shoeisha.co.jp": "翔泳社",
    "gihyo.jp": "技術評論社",
}

TOC_HEADING_PATTERN = re.compile(r"(table of contents|contents|目次)", re.I)
CHAPTER_PATTERN = re.compile(
    r"^(chapter\s+\d+|part\s+[ivxlcdm0-9]+|appendix\s+[a-z0-9]+|第[一二三四五六七八九十百千ivxlcdm]+部|[0-9０-９]+章)",
    re.I,
)
SECTION_PATTERN = re.compile(r"^[0-9０-９]+\.[0-9０-９]+")
PART_PATTERN = re.compile(r"^(part\s+[ivxlcdm0-9]+|第[一二三四五六七八九十百千ivxlcdm]+部)", re.I)
STANDALONE_PATTERN = re.compile(
    r"^(foreword|preface|introduction|afterword|conclusion|acknowledg(e)?ments?|本書への賛辞|はじめに|まえがき|序文|あとがき|謝辞|索引|付録)",
    re.I,
)


def normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def normalize_url(url: str) -> str:
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path}".rstrip("/")


def get_supported_source_label(hostname: str) -> str | None:
    host = hostname.lower()
    for domain, label in SUPPORTED_DOMAINS.items():
        if host == domain or host.endswith(f".{domain}"):
            return label
    return None


def text_looks_like_toc_entry(text: str) -> bool:
    if not text or len(text) < 3 or len(text) > 180:
        return False
    if TOC_HEADING_PATTERN.search(text):
        return False
    return bool(
        CHAPTER_PATTERN.search(text)
        or SECTION_PATTERN.search(text)
        or ":" in text
        or "：" in text
        or "システム" in text
        or "設計" in text
        or "学習" in text
        or "API" in text
    )


def unique_strings(values: list[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        normalized = normalize_whitespace(value)
        key = normalized.lower()
        if not normalized or key in seen:
            continue
        seen.add(key)
        output.append(normalized)
    return output


def extract_cover_image_url(soup: BeautifulSoup, source_url: str) -> str | None:
    for selector, attribute in (
        ("img.cover-photo", "src"),
        ("img[class*='cover-photo']", "src"),
        ("meta[property='og:image']", "content"),
        ("meta[name='twitter:image']", "content"),
    ):
        node = soup.select_one(selector)
        if not node:
            continue
        value = node.get(attribute)
        if value:
            return urljoin(source_url, value)
    return None


def extract_json_ld(soup: BeautifulSoup) -> tuple[str | None, list[str], list[str]]:
    title: str | None = None
    authors: list[str] = []
    toc_entries: list[str] = []

    for tag in soup.select("script[type='application/ld+json']"):
        raw = tag.string or tag.get_text()
        if not raw:
            continue
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            continue

        nodes = payload if isinstance(payload, list) else [payload]
        for node in nodes:
            if not isinstance(node, dict):
                continue
            node_types = node.get("@type", [])
            if isinstance(node_types, str):
                node_types = [node_types]
            if "Book" not in node_types:
                continue
            title = title or normalize_whitespace(node.get("name", ""))
            authors.extend(collect_authors(node.get("author")))
            raw_toc = node.get("tableOfContents")
            if isinstance(raw_toc, list):
                toc_entries.extend(str(item) for item in raw_toc)
            elif isinstance(raw_toc, str):
                toc_entries.extend(line for line in raw_toc.splitlines() if line.strip())
    return title, unique_strings(authors), unique_strings(toc_entries)


def collect_authors(value) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [normalize_whitespace(part) for part in re.split(r"、|,|&| and |著|訳", value) if part.strip()]
    if isinstance(value, list):
        output: list[str] = []
        for item in value:
            output.extend(collect_authors(item))
        return output
    if isinstance(value, dict):
        name = value.get("name")
        return [normalize_whitespace(name)] if isinstance(name, str) and name.strip() else []
    return []


def gather_toc_entries(soup: BeautifulSoup) -> list[str]:
    entries: list[str] = []

    toc_root = soup.select_one("#toc")
    if toc_root:
        for element in toc_root.select("li, p, div, a, dd, dt, pre"):
            entries.extend(extract_texts(element.get_text("\n")))

    for heading in soup.select("h1, h2, h3, h4, h5, h6"):
        text = normalize_whitespace(heading.get_text())
        if not TOC_HEADING_PATTERN.search(text):
            continue
        sibling = heading
        steps = 0
        while sibling and steps < 12:
            sibling = sibling.find_next_sibling()
            if not sibling:
                break
            if sibling.name in {"h1", "h2", "h3", "h4", "h5", "h6"}:
                break
            entries.extend(extract_texts(sibling.get_text("\n")))
            steps += 1

    if not entries:
        for selector in ("[id*='toc']", "[class*='toc']", "[class*='contents']", "[class*='mokji']"):
            for root in soup.select(selector):
                entries.extend(extract_texts(root.get_text("\n")))

    if not entries:
        for element in soup.select("li, p"):
            entries.extend(extract_texts(element.get_text("\n")))

    return unique_strings([entry for entry in entries if text_looks_like_toc_entry(entry)])


def extract_texts(raw: str) -> list[str]:
    return [
        normalized
        for line in raw.splitlines()
        if (normalized := normalize_whitespace(line)) and text_looks_like_toc_entry(normalized)
    ]


def split_chapters(toc_entries: list[str]) -> list[ExtractedChapter]:
    chapters: list[ExtractedChapter] = []
    current_part: str | None = None
    current_chapter: ExtractedChapter | None = None

    for entry in toc_entries:
        if PART_PATTERN.search(entry):
            current_part = entry
            current_chapter = None
            continue
        if STANDALONE_PATTERN.search(entry):
            current_chapter = ExtractedChapter(
                chapter_key=f"chapter-{len(chapters) + 1}",
                title=entry,
                sort_order=len(chapters),
                part_title=None,
                toc_entries=[entry],
            )
            chapters.append(current_chapter)
            continue
        if CHAPTER_PATTERN.search(entry) and not SECTION_PATTERN.search(entry):
            current_chapter = ExtractedChapter(
                chapter_key=f"chapter-{len(chapters) + 1}",
                title=entry,
                sort_order=len(chapters),
                part_title=current_part,
                toc_entries=[entry],
            )
            chapters.append(current_chapter)
            continue
        if current_chapter:
            current_chapter.toc_entries.append(entry)

    if not chapters:
        for index, entry in enumerate(toc_entries):
            chapters.append(
                ExtractedChapter(
                    chapter_key=f"chapter-{index + 1}",
                    title=entry,
                    sort_order=index,
                    part_title=None,
                    toc_entries=[entry],
                )
            )
    return chapters


def extract_book(url: str, html: str) -> ExtractedBook:
    parsed = urlparse(url)
    source_label = get_supported_source_label(parsed.hostname or "")
    if not source_label:
        raise ValueError("Unsupported source")

    soup = BeautifulSoup(html, "html.parser")
    json_ld_title, json_ld_authors, json_ld_toc = extract_json_ld(soup)

    title = json_ld_title or normalize_whitespace(soup.title.get_text() if soup.title else "")
    authors = json_ld_authors
    if not authors:
        meta_authors = soup.select("meta[name='author'], meta[property='book:author']")
        authors = unique_strings([tag.get("content", "") for tag in meta_authors])

    toc_entries = json_ld_toc or gather_toc_entries(soup)
    chapters = split_chapters(toc_entries)

    return ExtractedBook(
        source_url=url,
        normalized_url=normalize_url(url),
        source_site=source_label,
        title=title or normalize_url(url).rsplit("/", 1)[-1],
        cover_image_url=extract_cover_image_url(soup, url),
        authors=authors,
        page_title=normalize_whitespace(soup.title.get_text()) if soup.title else None,
        toc_entries=toc_entries,
        extraction_notes=[
            f"{source_label} のページから目次を抽出しました。",
            f"{len(toc_entries)} 件の目次候補を検出しました。",
        ],
        chapters=chapters,
    )
