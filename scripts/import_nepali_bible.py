#!/usr/bin/env python3
"""Download the CC BY-SA Nepali ULB USFM archive and build static reader JSON."""

from __future__ import annotations

import io
import json
import re
import sys
import urllib.request
import zipfile
from pathlib import Path

SOURCE_URL = "https://ebible.org/Scriptures/npiulb_usfm.zip"
SOURCE_PAGE = "https://ebible.org/Bible/details.php?id=npiulb"
OUTPUT_ROOT = Path(__file__).resolve().parents[1] / "public" / "bible" / "npiulb"
BOOK_FILE = re.compile(r"^(\d+)-([A-Z0-9]{3})npiulb\.usfm$")
NOTE_BLOCKS = re.compile(r"\\(?:f|fe|ef|x)\b.*?\\(?:f|fe|ef|x)\*", re.DOTALL)
FIGURE_BLOCKS = re.compile(r"\\fig\b.*?\\fig\*", re.DOTALL)
WORD_MARKER = re.compile(r"\\w\s+([^|\\]+)\|[^\\]+\\w\*")
MILESTONE = re.compile(r"\\(?:zaln|k)-(?:s|e)\b[^\\]*?\\\*")
INLINE_MARKER = re.compile(r"\\[a-zA-Z0-9-]+\*?(?:\s+)?")
SKIP_LINE = re.compile(r"^\\(?:id|ide|h|toc\d?|mt\d?|mte\d?|s\d?|ms\d?|mr|r|d|sp|cl|cp|rem)\b")


def clean_text(value: str) -> str:
    value = WORD_MARKER.sub(r"\1", value)
    value = MILESTONE.sub("", value)
    value = INLINE_MARKER.sub("", value)
    value = value.replace("//", " ")
    return re.sub(r"\s+", " ", value).strip()


def header_value(raw: str, marker: str) -> str:
    match = re.search(rf"^\\{marker}\s+(.+?)\s*$", raw, re.MULTILINE)
    return clean_text(match.group(1)) if match else ""


def parse_book(filename: str, raw: str, order: int, book_id: str) -> tuple[dict, dict, int]:
    raw = NOTE_BLOCKS.sub("", raw)
    raw = FIGURE_BLOCKS.sub("", raw)
    name = header_value(raw, "toc2") or header_value(raw, "h") or book_id
    long_name = header_value(raw, "toc1") or name
    chapters: dict[str, list[dict[str, str]]] = {}
    current_chapter: str | None = None
    current_verse: dict[str, str] | None = None

    def flush_verse() -> None:
        nonlocal current_verse
        if current_chapter and current_verse:
            current_verse["text"] = clean_text(current_verse["text"])
            if current_verse["text"]:
                chapters.setdefault(current_chapter, []).append(current_verse)
        current_verse = None

    for source_line in raw.splitlines():
        line = source_line.strip()
        if not line:
            continue

        chapter_match = re.match(r"^\\c\s+(\d+)", line)
        if chapter_match:
            flush_verse()
            current_chapter = chapter_match.group(1)
            chapters.setdefault(current_chapter, [])
            continue

        verse_match = re.match(r"^\\v\s+([^\s]+)\s*(.*)$", line)
        if verse_match and current_chapter:
            flush_verse()
            current_verse = {"number": verse_match.group(1), "text": verse_match.group(2)}
            continue

        if current_verse and not SKIP_LINE.match(line):
            continuation = clean_text(line)
            if continuation:
                current_verse["text"] += f" {continuation}"

    flush_verse()
    verse_count = sum(len(verses) for verses in chapters.values())
    if not chapters or not verse_count:
        raise ValueError(f"No Scripture content parsed from {filename}")

    summary = {
        "id": book_id,
        "name": name,
        "longName": long_name,
        "order": order,
        "testament": "old" if order <= 39 else "new",
        "chapters": len(chapters),
    }
    content = {"book": summary, "chapters": chapters}
    return summary, content, verse_count


def main() -> int:
    request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "Church-App-Bible-Importer/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        archive = response.read()

    books: list[dict] = []
    parsed: list[tuple[str, dict]] = []
    total_verses = 0
    with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
        source_files = []
        for filename in bundle.namelist():
            match = BOOK_FILE.match(Path(filename).name)
            if match:
                source_files.append((int(match.group(1)), match.group(2), filename))

        source_files.sort(key=lambda item: item[0])
        for order, (_, book_id, filename) in enumerate(source_files, start=1):
            raw = bundle.read(filename).decode("utf-8-sig")
            summary, content, verse_count = parse_book(filename, raw, order, book_id)
            books.append(summary)
            parsed.append((book_id, content))
            total_verses += verse_count

    if len(books) != 66 or total_verses < 30_000:
        raise ValueError(f"Import validation failed: {len(books)} books, {total_verses} verses")

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    for old_file in OUTPUT_ROOT.glob("*.json"):
        old_file.unlink()

    for book_id, content in parsed:
        (OUTPUT_ROOT / f"{book_id}.json").write_text(
            json.dumps(content, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )

    index = {
        "translation": {
            "id": "npiulb",
            "name": "नेपाली अनलक्क्ड लिटरल बाइबल",
            "shortName": "NPIULB",
            "language": "नेपाली",
            "languageCode": "npi",
            "copyright": "Copyright © 2019 Door43 World Missions Community",
            "license": "CC BY-SA 4.0",
            "source": SOURCE_PAGE,
            "sourceFilesDated": "2025-12-12",
            "formatNote": "USFM formatting converted to JSON; Scripture wording is not intentionally changed.",
        },
        "books": books,
        "stats": {"books": len(books), "chapters": sum(book["chapters"] for book in books), "verses": total_verses},
    }
    (OUTPUT_ROOT / "index.json").write_text(
        json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    print(f"Imported {len(books)} books and {total_verses} verses into {OUTPUT_ROOT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
