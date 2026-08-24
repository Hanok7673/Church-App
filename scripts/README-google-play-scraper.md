# Google Play metadata scraper

This utility extracts public listing metadata from one Google Play app-details page. It does not access reviews, APK files, song lyrics, chords, or private app data.

## Setup on Windows

1. Install Python 3.11 or newer from https://www.python.org/downloads/ and enable **Add Python to PATH** during installation.
2. Install Google Chrome if you want the automatic Selenium fallback for dynamically rendered details. Requests-only extraction works without Chrome.
3. From the Church App project folder, run:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r .\scripts\requirements-play-store-scraper.txt
```

## Run

```powershell
.\.venv\Scripts\python.exe .\scripts\scrape_google_play_metadata.py --output .\outputs\google-play-metadata.json
```

To deliberately skip browser rendering:

```powershell
.\.venv\Scripts\python.exe .\scripts\scrape_google_play_metadata.py --requests-only
```

The program prints UTF-8 JSON and optionally saves the same JSON to `--output`. A field is `null` when Google does not publish it in the retrieved listing. The program checks the live `robots.txt` before every run and stops if access is no longer permitted.

## Back up and sync to Supabase

Add the server-only Supabase secret key to `.env` as `SUPABASE_SECRET_KEY`. Never use a `NEXT_PUBLIC_` prefix for this value. Then run:

```powershell
.\.venv\Scripts\python.exe .\scripts\scrape_and_sync_google_play.py
```

The command first creates a timestamped JSON backup in `outputs/google-play/`, then upserts the public listing metadata into `public.apps` using `app_id` as the conflict key. It cannot populate the worship-song catalog because a Google Play listing does not expose the installed app's song database.
