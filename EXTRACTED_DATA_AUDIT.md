# Extracted Android data audit

Audit date: 2026-08-22

## Scope

Read-only inspection of:

`C:\Users\djbaj\Downloads\android-backup-tookit-20221220\android-backup-tookit\android-backup-processor\executable\apps\np.com.paurakh.nepali_christian_lyrics`

No song text or chords were copied into the Church App project or Supabase during this audit.

## Inventory summary

- 13 directories, 31 files, approximately 41.4 MB total.
- Main content candidates:
  - `r/app_flutter/nepali_christian_lyrics.db` — 20,378,367 bytes.
  - `r/app_flutter/nepali_christian_lyrics.hive` — 20,378,367 bytes.
- Both main files have the same SHA-256 hash:
  `C15F26D4CC95C3D073CA9052F25FDEADA6DBA248C46286C971C0AA637AFE02E1`.
- Despite the `.db` extension, the main content is a Flutter Hive store, not SQLite.
- The actual SQLite files contain Google analytics transport data and cached-image metadata, not songs.
- Other files contain application preferences, Firebase/Crashlytics state, cached fonts, and installation metadata.

## Content structure

Schema-only inspection of the Hive payload found:

- The Hive box contains repeated historical snapshots. The latest live snapshot has 1,968 unique song records and 166 unique artist records.
- Song fields: `id`, `name`, `description`, `created`, `nepaliLyrics`, `romanLyrics`, `translitLyrics`, `mainChords`, `artist`, `songType`, `songLanguage`, `songNumber`, `beat`, `audioUrl`, `videoUrl`, `addedBy`, `updatedBy`, and `lastUpdate`.
- Artist fields include `id`, `name`, `description`, `created`, `photoUrl`, and `songs`.

The earlier structural count of 7,872 song-field occurrences represented four stored snapshots, not 7,872 current songs. A frame-aware parser now selects only the latest value for each Hive key. The latest snapshot contains 848 bhajans, 336 choruses, 70 children’s songs, and 714 other songs.

## Licensing and privacy findings

- No license, copyright, permission, attribution, source-name, or source-URL field was found in the content structure.
- No accompanying license or written redistribution permission was present in the folder.
- A personal Android backup may contain installation identifiers and analytics/crash-report state. Do not commit, publish, upload, or place the complete folder in Supabase.
- Possession of an extracted backup does not establish permission to redistribute its song lyrics or chord arrangements.

## Import status

Completed 2026-08-22. The user confirmed that the dataset was provided by the owner for Church App use. The latest Hive snapshot was validated and upserted into protected Supabase catalog tables with the authorization note preserved on every song.

If authorization is supplied, the safe import path is:

1. Work from one verified Hive file only; the `.db` and `.hive` copies are duplicates.
2. Parse records into a staging file outside the web bundle.
3. Validate required fields, record counts, numbering, duplicates, encoding, and licensing attribution.
4. Import into a restricted Supabase staging table.
5. Publish only records covered by the authorization.
