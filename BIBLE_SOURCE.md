# Nepali Bible source and update notes

## Selected source

- Translation: Nepali Unlocked Literal Bible (NPIULB)
- Publisher/licensor: Door43 World Missions Community
- Copyright: Copyright © 2019 Door43 World Missions Community
- License: Creative Commons Attribution-ShareAlike 4.0 International
- Source page: https://ebible.org/Bible/details.php?id=npiulb
- Developer source: https://ebible.org/Scriptures/npiulb_usfm.zip
- Imported source-file date: 2025-12-12
- Imported archive SHA-256: `1D81E0BB84A7F2B4D35B4F9A9403D9FF3B75CFAC74E66DBD3BA3B0E1BC6EFB41`

The app distributes the converted Bible JSON under the same CC BY-SA 4.0 license. The conversion removes USFM formatting markers, headings, footnotes, and cross-references; it does not intentionally change Scripture wording. See `public/bible/npiulb/LICENSE.txt` for the distributed notice.

## Why this method is used

API.Bible and Bible Brain provide useful Scripture APIs, but both require private developer API keys and carry provider-specific content conditions. The eBible NPIULB developer download is complete, key-free, versionable, and explicitly permits redistribution with attribution and ShareAlike licensing. It therefore works reliably for the current local preview and avoids putting a private API key in the browser.

## Refreshing the Bible data later

No action is required for normal development. To intentionally refresh from the current eBible USFM archive:

1. Review the source page and confirm that the license and attribution requirements have not changed.
2. Run `python scripts/import_nepali_bible.py` from the project folder.
3. Review the reported totals. The importer refuses output unless it finds 66 books and at least 30,000 verses.
4. Compare a sample of generated verses with the source and update the archive checksum and source date in this file.
5. Run the production build before release.

The generated reader data lives in `public/bible/npiulb/`, one JSON file per book plus `index.json`.
