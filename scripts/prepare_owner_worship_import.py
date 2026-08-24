#!/usr/bin/env python3
"""Parse the owner-authorized Flutter Hive worship catalog into import batches.

Only the latest live value for each Hive key is used. Repeated historical
frames in the box are ignored. Android preferences, analytics, Crashlytics,
and installation identifiers are never read by this utility.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import struct
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


SOURCE_CODE = "paurakh_owner_export_2026_08_22"
SOURCE_NAME = "Nepali Christian Lyrics & Chords — owner-provided export"
SOURCE_URL = "https://nepalichristianapp.com/"
LICENSE_NOTE = (
    "Owner-provided dataset; Church App import authorization confirmed "
    "by the project owner on 2026-08-22."
)
CATEGORY_LABELS = {
    "bhajan": "भजन",
    "chorus": "कोरस",
    "kids": "बाल कोरस",
    "others": "अन्य",
}
TIMESTAMP_PATTERN = re.compile(
    r"^Timestamp\(seconds=(?P<seconds>-?\d+), nanoseconds=(?P<nanoseconds>\d+)\)$"
)


def parse_hive_string_frames(path: Path) -> dict[str, str]:
    data = path.read_bytes()
    latest: dict[str, str] = {}
    position = 0

    while position < len(data):
        if position + 6 > len(data):
            raise ValueError(f"Truncated Hive frame header at byte {position}")
        frame_length = struct.unpack_from("<I", data, position)[0]
        if frame_length <= 0 or position + frame_length > len(data):
            raise ValueError(f"Invalid Hive frame length at byte {position}")

        key_type = data[position + 4]
        key_length = data[position + 5]
        key_start = position + 6
        key_end = key_start + key_length
        if key_type != 1 or key_end >= position + frame_length:
            position += frame_length
            continue

        key = data[key_start:key_end].decode("utf-8")
        value_type = data[key_end]
        if value_type == 4:
            value_length = struct.unpack_from("<I", data, key_end + 1)[0]
            value_start = key_end + 5
            value_end = value_start + value_length
            if value_end > position + frame_length:
                raise ValueError(f"Invalid string value length for Hive key {key!r}")
            latest[key] = data[value_start:value_end].decode("utf-8")
        position += frame_length

    return latest


def decode_record_list(raw_value: str, key: str) -> list[dict[str, Any]]:
    outer = json.loads(raw_value)
    if not isinstance(outer, list):
        raise ValueError(f"Hive key {key!r} is not a JSON list")
    records: list[dict[str, Any]] = []
    for index, item in enumerate(outer):
        decoded = json.loads(item) if isinstance(item, str) else item
        if not isinstance(decoded, dict):
            raise ValueError(f"{key}[{index}] is not a JSON object")
        records.append(decoded)
    return records


def clean_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def parse_timestamp(value: Any) -> str | None:
    text = clean_text(value)
    if text is None:
        return None
    match = TIMESTAMP_PATTERN.fullmatch(text)
    if match is None:
        return None
    seconds = int(match.group("seconds"))
    nanoseconds = int(match.group("nanoseconds"))
    parsed = datetime.fromtimestamp(
        seconds + (nanoseconds / 1_000_000_000), tz=timezone.utc
    )
    return parsed.isoformat()


def validate_records(
    artists: list[dict[str, Any]], songs: list[dict[str, Any]]
) -> dict[str, Any]:
    artist_ids = [clean_text(artist.get("id")) for artist in artists]
    song_ids = [clean_text(song.get("id")) for song in songs]
    if any(identifier is None for identifier in artist_ids + song_ids):
        raise ValueError("Every artist and song must have a non-empty id")
    if len(set(artist_ids)) != len(artist_ids):
        raise ValueError("Duplicate artist ids found in latest Hive snapshot")
    if len(set(song_ids)) != len(song_ids):
        raise ValueError("Duplicate song ids found in latest Hive snapshot")

    missing_names = sum(clean_text(song.get("name")) is None for song in songs)
    missing_nepali_lyrics = sum(
        clean_text(song.get("nepaliLyrics")) is None for song in songs
    )
    if missing_names or missing_nepali_lyrics:
        raise ValueError(
            f"Required song data missing: names={missing_names}, "
            f"nepaliLyrics={missing_nepali_lyrics}"
        )

    artist_id_set = set(artist_ids)
    artist_references = [clean_text(song.get("artist")) for song in songs]
    return {
        "artist_count": len(artists),
        "song_count": len(songs),
        "songs_by_type": dict(Counter(str(song.get("songType")) for song in songs)),
        "songs_by_language": dict(
            Counter(str(song.get("songLanguage")) for song in songs)
        ),
        "songs_with_chords": sum(
            clean_text(song.get("mainChords")) is not None for song in songs
        ),
        "songs_with_numbers": sum(song.get("songNumber") is not None for song in songs),
        "artist_references_resolved": sum(
            reference in artist_id_set for reference in artist_references if reference
        ),
        "artist_references_unresolved": sum(
            reference not in artist_id_set
            for reference in artist_references
            if reference
        ),
    }


def normalize_artist(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "external_source": SOURCE_CODE,
        "external_id": clean_text(record.get("id")),
        "name": clean_text(record.get("name")),
        "description": clean_text(record.get("description")),
        "photo_url": clean_text(record.get("photoUrl")),
        "original_created_at": parse_timestamp(record.get("created")),
        "source_payload": record,
    }


def normalize_song(
    record: dict[str, Any], artist_ids: set[str]
) -> dict[str, Any]:
    song_type = clean_text(record.get("songType")) or "others"
    artist_credit = clean_text(record.get("artist"))
    song_number = record.get("songNumber")
    if not isinstance(song_number, int):
        song_number = None
    return {
        "external_source": SOURCE_CODE,
        "external_id": clean_text(record.get("id")),
        "title_ne": clean_text(record.get("name")),
        "description": clean_text(record.get("description")),
        "category": CATEGORY_LABELS.get(song_type, "अन्य"),
        "lyrics_ne": clean_text(record.get("nepaliLyrics")),
        "lyrics_romanized": clean_text(record.get("romanLyrics")),
        "lyrics_transliterated": clean_text(record.get("translitLyrics")),
        "chords": clean_text(record.get("mainChords")),
        "song_type": song_type,
        "song_language": clean_text(record.get("songLanguage")),
        "song_number": song_number,
        "beat": clean_text(record.get("beat")),
        "audio_url": clean_text(record.get("audioUrl")),
        "video_url": clean_text(record.get("videoUrl")),
        "artist_external_id": artist_credit if artist_credit in artist_ids else None,
        "artist_credit": artist_credit,
        "source_name": SOURCE_NAME,
        "source_url": SOURCE_URL,
        "license_note": LICENSE_NOTE,
        "is_published": True,
        "original_created_at": parse_timestamp(record.get("created")),
        "original_updated_at": parse_timestamp(record.get("lastUpdate")),
        "source_payload": record,
    }


def chunks(records: list[dict[str, Any]], size: int) -> Iterable[list[dict[str, Any]]]:
    for index in range(0, len(records), size):
        yield records[index : index + size]


def write_batches(
    directory: Path, records: list[dict[str, Any]], batch_size: int
) -> int:
    directory.mkdir(parents=True, exist_ok=True)
    count = 0
    for count, batch in enumerate(chunks(records, batch_size), start=1):
        destination = directory / f"{count:04d}.json"
        destination.write_text(
            json.dumps(batch, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
    return count


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument(
        "--output-dir", type=Path, default=Path("outputs/worship-owner-import")
    )
    parser.add_argument("--artist-batch-size", type=int, default=100)
    parser.add_argument("--song-batch-size", type=int, default=50)
    return parser.parse_args()


def main() -> int:
    args = parse_arguments()
    if args.artist_batch_size <= 0 or args.song_batch_size <= 0:
        raise ValueError("Batch sizes must be positive")

    latest = parse_hive_string_frames(args.source)
    if "artists" not in latest or "songs" not in latest:
        raise ValueError("Latest Hive state does not contain artists and songs")

    artists = decode_record_list(latest["artists"], "artists")
    songs = decode_record_list(latest["songs"], "songs")
    summary = validate_records(artists, songs)
    artist_ids = {str(artist["id"]) for artist in artists}

    normalized_artists = [normalize_artist(record) for record in artists]
    normalized_songs = [normalize_song(record, artist_ids) for record in songs]
    artist_batches = write_batches(
        args.output_dir / "artists", normalized_artists, args.artist_batch_size
    )
    song_batches = write_batches(
        args.output_dir / "songs", normalized_songs, args.song_batch_size
    )

    summary.update(
        {
            "source_code": SOURCE_CODE,
            "source_sha256": hashlib.sha256(args.source.read_bytes()).hexdigest(),
            "artist_batches": artist_batches,
            "song_batches": song_batches,
            "prepared_at_utc": datetime.now(timezone.utc).isoformat(),
        }
    )
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

