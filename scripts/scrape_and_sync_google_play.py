#!/usr/bin/env python3
"""Back up public Google Play metadata and upsert it into Supabase.

This utility imports the robots-aware scraper from the adjacent script. It
does not retrieve reviews, APKs, song lyrics, chords, or private app data.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

from scrape_google_play_metadata import AppMetadata, TARGET_URL, scrape


APP_ID = "com.nmtech.christainbhajanandchords"
DEFAULT_BACKUP_DIRECTORY = Path("outputs/google-play")


def json_safe(value: Any) -> Any:
    if isinstance(value, (datetime,)):
        return value.astimezone(timezone.utc).isoformat()
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]
    return value


def save_local_backup(metadata: AppMetadata, output: Path | None = None) -> Path:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    destination = output or (
        DEFAULT_BACKUP_DIRECTORY / f"christian-bhajan-chords-{timestamp}.json"
    )
    destination.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(json_safe(asdict(metadata)), ensure_ascii=False, indent=2)

    temporary = destination.with_suffix(destination.suffix + ".tmp")
    temporary.write_text(payload + "\n", encoding="utf-8")
    temporary.replace(destination)
    return destination


def parse_store_date(value: str | None) -> str | None:
    if not value:
        return None
    for date_format in ("%b %d, %Y", "%B %d, %Y", "%Y-%m-%d"):
        try:
            parsed = datetime.strptime(value, date_format).replace(tzinfo=timezone.utc)
            return parsed.isoformat()
        except ValueError:
            continue
    return None


def metadata_to_row(metadata: AppMetadata) -> dict[str, Any]:
    raw_data = json_safe(asdict(metadata))
    return {
        "app_id": APP_ID,
        "title": metadata.app_name or APP_ID,
        "developer": metadata.developer,
        "score": metadata.rating_score,
        "reviews": metadata.total_reviews_count,
        "installs": metadata.number_of_installs,
        "size": metadata.app_size,
        "version": metadata.current_version,
        "android_version": metadata.android_os_requirement,
        "description": metadata.app_description,
        "screenshots": metadata.screenshot_urls,
        "updated_date": parse_store_date(metadata.last_updated_date),
        "source_url": metadata.source_url,
        "raw_data": raw_data,
        "last_fetched": metadata.scraped_at_utc,
    }


def load_server_credentials() -> tuple[str, str]:
    load_dotenv()
    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    secret = os.getenv("SUPABASE_SECRET_KEY") or os.getenv(
        "SUPABASE_SERVICE_ROLE_KEY"
    )
    if not url:
        raise RuntimeError("Set SUPABASE_URL in the server-side .env file.")
    if not secret:
        raise RuntimeError(
            "Set SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) "
            "in the server-side .env file."
        )
    return url, secret


def upsert_to_supabase(metadata: AppMetadata) -> dict[str, Any]:
    url, secret = load_server_credentials()
    client: Client = create_client(url, secret)
    response = (
        client.table("apps")
        .upsert(metadata_to_row(metadata), on_conflict="app_id")
        .select("app_id,title,last_fetched")
        .execute()
    )
    if not response.data:
        raise RuntimeError("Supabase returned no row after the metadata upsert.")
    return response.data[0]


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=TARGET_URL)
    parser.add_argument("--output", type=Path, help="Optional backup JSON path")
    parser.add_argument(
        "--requests-only",
        action="store_true",
        help="Skip Selenium if dynamically rendered fields are absent",
    )
    parser.add_argument(
        "--skip-supabase",
        action="store_true",
        help="Create the local backup without performing the database upsert",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_arguments()
    try:
        metadata = scrape(args.url, allow_selenium=not args.requests_only)
        backup_path = save_local_backup(metadata, args.output)
        print(f"Saved local metadata backup: {backup_path}")

        if args.skip_supabase:
            print("Skipped Supabase upsert by request.")
            return 0

        row = upsert_to_supabase(metadata)
        print(
            "Upserted Supabase metadata: "
            f"{row['app_id']} ({row['title']}) at {row['last_fetched']}"
        )
        return 0
    except Exception as exc:
        print(f"Metadata sync failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())

