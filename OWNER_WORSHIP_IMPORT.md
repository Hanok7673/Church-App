# Owner-authorized worship catalog import

Import date: 2026-08-22

## Authorization and source

- The user confirmed that the extracted dataset was provided by the owner for use in Church App.
- Source code: `paurakh_owner_export_2026_08_22`.
- Source file SHA-256: `C15F26D4CC95C3D073CA9052F25FDEADA6DBA248C46286C971C0AA637AFE02E1`.
- Only `r/app_flutter/nepali_christian_lyrics.db` was parsed. The identical `.hive` copy and all Android preferences, Firebase, Crashlytics, analytics, cache, and installation files were excluded.
- Raw prepared batches are kept under ignored `outputs/worship-owner-import/` and are not part of the web bundle or source control.

## Imported catalog

- 166 artists.
- 1,968 unique songs: 848 bhajans, 336 choruses, 70 children’s songs, and 714 other songs.
- 1,958 Nepali, 7 Hindi, and 3 English songs.
- 1,485 songs include a base key; 1,461 songs include inline chord-position markers in the lyrics.
- 1,254 songs include printed numbers.
- 714 song-to-artist references resolved to the supplied artist collection; unmatched owner-provided credits remain preserved as text.
- Zero missing titles or Nepali lyrics and zero duplicate external song IDs.

## Database behavior

- Artists are upserted by `(external_source, external_id)` into `public.worship_artists`.
- Songs are upserted by `(external_source, external_id)` into `public.songs`.
- The original owner payload is retained as JSONB for fidelity, while normalized fields support search, numbering, categories, chords, audio/video references, and future UI pagination.
- RLS remains enabled. The later preview-reader migration opens read-only access only to published, global rows from this authorized source.
- Anonymous column grants exclude the raw owner payload and import metadata; anonymous insert, update, and delete remain revoked.
- `public.search_worship_songs` is a `SECURITY INVOKER` paginated metadata RPC, so the caller's RLS policy is always enforced.
- A random-token temporary RPC was used for the one-time batched upload and dropped immediately afterward.
- Supabase security advisor completed with no findings after import.

## Church App reader

- The worship screen now searches and pages through all 1,968 songs from Supabase in batches of 30.
- Filters cover bhajan, chorus, children’s chorus, other songs, and device-local favourites.
- Opening a song fetches only its normalized detail fields; the raw import payload is never requested by the browser.
- Inline markers such as `[A]` and `[E7]` render as chords directly above their matching lyric words.
- Chords are shown by default when positions are present and can be hidden or transposed from -12 to +12 semitones.
- Direct song hashes, device-local favourites, and device-local recap selection remain supported while authentication is deferred.

## Reproducible utilities

- `scripts/prepare_owner_worship_import.py` parses the latest live Hive frames and produces validated import batches.
- `scripts/run_owner_worship_import.py` sends prepared batches to an explicitly created temporary import RPC.
