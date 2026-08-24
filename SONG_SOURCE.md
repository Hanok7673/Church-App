# Nepali worship-song source and import guide

## Batch 5 decision

No reusable, key-free Nepali Christian lyrics API or catalog with a clear app-redistribution license was identified during the Batch 5 review. Public Nepali lyrics websites can be useful for discovering songs, but their visible pages did not grant permission to copy and redistribute the full lyrics in Church App. Musixmatch offers a licensed lyrics API, but it requires a private API key and is not a Nepali-Christian catalog.

Church App therefore uses a copyright-safe alternative for the preview:

- `public/songs/church-app-originals.json` contains six original Nepali demo songs created for this app.
- The demo catalog is dedicated under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/), so it can be used, changed, translated, or removed without requesting permission.
- The lyrics were not imported from existing songbooks, websites, recordings, or commercial lyrics services.
- The catalog is static and public. It does not bypass Supabase RLS and does not contain member data.

## Catalog format

The JSON file has catalog-level license metadata and a `songs` array. Every song requires:

- `id`: stable lowercase slug
- `titleNe` and `titleRomanized`
- `category`, `key`, `timeSignature`, and integer `tempo`
- `bibleReference.label` and a `BOOK/CHAPTER/VERSE` hash
- two or more lyric `sections`
- each section has `kind`, `label`, and lyric `lines`; `chord` is optional

Validate an edited catalog before building:

```powershell
npm run songs:validate
```

## Future admin import into Supabase

Real church songs must only be imported after the church confirms that it owns the lyrics, has written permission, or the license expressly permits app redistribution.

For the existing protected `public.songs` table, an authenticated church administrator can map the catalog as follows:

| Catalog field | Supabase column |
| --- | --- |
| `titleNe` | `title_ne` |
| `titleRomanized` | `title_romanized` |
| `category` | `category` |
| joined section labels and lyric lines | `lyrics_ne` |
| joined chord/lyric lines | `chords` |
| approved catalog or publisher | `source_name` |
| permission or license page | `source_url` |
| exact permission/license statement | `license_note` |

Imports must set `church_id`, leave `is_published = false` during review, and use the authenticated admin flow. Do not put the database password, service-role key, or third-party lyrics API key in browser code. After review, an authorized administrator can publish the approved record under the existing RLS policies.

Device-local favourites and preview recap selections are temporary. They can be migrated to authenticated Supabase favourites and recap items only after real authentication is enabled.

## Source review requested after Batch 5

The suggested Scribd upload, **Nepali Christian Bhajan Collection**, is a 324-page document whose page explicitly says **© All Rights Reserved**. A public Scribd reader or download button does not grant Church App permission to reproduce and redistribute the lyrics or chord arrangements.

The suggested GitHub file named `Nepali Christian Lyrics & Chords.md` contains only the privacy policy for another app. Its repository provides neither the song database nor a software/content license granting reuse of lyrics and chords.

For those reasons, Church App does not copy either source. The song schema and interface now support:

- `bookSection`: `भजन`, `कोरस`, or `मौलिक`
- the original songbook `number`
- original key and line-level chords
- live transposition from −12 to +12 semitones; 12 semitones equal one octave

To add the full Nepali Christian bhajan/chorus book, provide one of the following:

1. written permission from the book's publisher or rights holder allowing reproduction in Church App;
2. an official license page that expressly permits redistribution of the lyrics and chord arrangements; or
3. a songbook file owned by your church, together with confirmation that the church authorizes its use in this app.

Once permission is available, preserve the printed `भजन`/`कोरस` number exactly during import and record the permission in `source_name`, `source_url`, and `license_note` before publishing.
