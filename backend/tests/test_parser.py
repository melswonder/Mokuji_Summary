from pathlib import Path

from app.services.extractors.parser import extract_book


def test_extract_book_from_oreilly_fixture() -> None:
    fixture = (
        Path(__file__).resolve().parents[2] / "fixtures" / "oreilly-japan-sample.html"
    ).read_text(encoding="utf-8")
    book = extract_book("https://www.oreilly.co.jp/books/9784814401567/", fixture)
    assert book.title == "システム思考の世界へ"
    assert book.cover_image_url is None
    assert book.toc_entries[0] == "本書への賛辞"
    assert any(chapter.title == "1章 システム思考とは何か？" for chapter in book.chapters)
