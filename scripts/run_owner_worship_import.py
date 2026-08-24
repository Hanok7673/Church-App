#!/usr/bin/env python3
"""Send prepared owner-authorized worship batches to a temporary Supabase RPC."""

from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv


MAX_ATTEMPTS = 3


def load_public_connection() -> tuple[str, str]:
    load_dotenv(".env.local")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    if not url or not key:
        raise RuntimeError("Missing public Supabase URL or publishable key in .env.local")
    return url.rstrip("/"), key


def post_batch(
    session: requests.Session,
    endpoint: str,
    token: str,
    kind: str,
    rows: list[dict[str, Any]],
) -> dict[str, Any]:
    for attempt in range(MAX_ATTEMPTS):
        try:
            response = session.post(
                endpoint,
                json={"p_token": token, "p_kind": kind, "p_rows": rows},
                timeout=(10, 90),
            )
            if response.status_code < 500 and response.status_code != 429:
                response.raise_for_status()
                result = response.json()
                if not isinstance(result, dict):
                    raise RuntimeError("Unexpected RPC response shape")
                return result
        except requests.RequestException:
            if attempt == MAX_ATTEMPTS - 1:
                raise
        time.sleep(2**attempt)
    raise RuntimeError(f"Supabase RPC remained unavailable for {kind} batch")


def import_directory(
    session: requests.Session,
    endpoint: str,
    token: str,
    kind: str,
    directory: Path,
) -> tuple[int, int]:
    files = sorted(directory.glob("*.json"))
    batches = 0
    records = 0
    for file in files:
        rows = json.loads(file.read_text(encoding="utf-8"))
        if not isinstance(rows, list):
            raise RuntimeError(f"Batch is not a list: {file}")
        result = post_batch(session, endpoint, token, kind, rows)
        received = int(result.get("received", -1))
        if received != len(rows):
            raise RuntimeError(
                f"Supabase count mismatch for {file}: sent={len(rows)} received={received}"
            )
        batches += 1
        records += len(rows)
        if batches % 10 == 0 or batches == len(files):
            print(f"{kind}: {batches}/{len(files)} batches, {records} records")
    return batches, records


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batches", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_arguments()
    token = os.getenv("CHURCH_WORSHIP_IMPORT_TOKEN")
    if not token:
        raise RuntimeError("CHURCH_WORSHIP_IMPORT_TOKEN is not set")

    url, key = load_public_connection()
    endpoint = f"{url}/rest/v1/rpc/import_owner_worship_batch"
    session = requests.Session()
    session.headers.update(
        {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }
    )

    artist_batches, artist_records = import_directory(
        session, endpoint, token, "artists", args.batches / "artists"
    )
    song_batches, song_records = import_directory(
        session, endpoint, token, "songs", args.batches / "songs"
    )
    print(
        "Import complete: "
        f"artists={artist_records} ({artist_batches} batches), "
        f"songs={song_records} ({song_batches} batches)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

