# Church App

A Nepali-first church community app for fellowship schedules, role assignments, recaps, Bible reading, and Christian worship songs.

Development is intentionally split into reviewed batches. See `PROJECT_TRACKER.md` for completed work and the next batch.

Role-specific account creation and multi-account testing are documented in `ROLE_ACCOUNT_SETUP.md`.

## Current preview

The app currently lets a visitor continue with either a valid Nepal mobile number or Gmail address without receiving an OTP or authorization code. This is explicitly a temporary, device-local preview flow:

- it does not create or authenticate a Supabase user;
- preview identity and profile details stay only in that browser's local storage;
- it cannot access protected Supabase member data;
- clearing browser data or using the in-app reset removes the preview profile.

Real authentication must be restored before production or before any member-only database feature is enabled.

After completing the preview profile, the app includes a Nepali home dashboard, sample notifications, upcoming fellowship cards, list/calendar schedule views, fellowship details, map directions, and role previews. Schedule and notification content is visibly labelled as sample data.

The Nepali Bible reader is available from the dashboard and bottom navigation. It contains all 66 books of the CC BY-SA 4.0 Nepali Unlocked Literal Bible, with chapter navigation, in-book search, adjustable text, temporary device-local bookmarks, and copyable verse links. Source and refresh details are documented in `BIBLE_SOURCE.md`.

The worship-song section contains six original Nepali preview songs with songbook section/number metadata, categories, search, device-local favourites, optional chords, live key transposition from −12 to +12 semitones, adjustable lyrics, Scripture-theme links, and temporary recap selection. The demo catalog is CC0 and can later be replaced through the documented licensed admin import path in `SONG_SOURCE.md`. The full numbered bhajan/chorus book remains pending written redistribution permission. Volunteering and protected member actions remain queued for later batches.

## Supabase foundation

The Supabase schema, generated TypeScript types, RLS policies, and public client configuration remain in the project for later authenticated batches. Anonymous access to application tables remains revoked.

## Security

Never place the Supabase database password or service-role key in client-side code or committed files. Public browser configuration should use only the project URL and anon/publishable key.
