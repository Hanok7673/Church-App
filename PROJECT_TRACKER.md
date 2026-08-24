# Church App — Build Tracker

Last updated: 2026-08-23

## Product direction

- Nepali-first mobile church community app based on the supplied 21-screen Stitch reference.
- Visual system: deep teal, warm neutral surfaces, rounded cards, high contrast, large tap targets, and accessible Nepali typography.
- Core platform: Supabase for application data, real email/password authentication, session management, and Row Level Security authorization.
- Bible and worship content: prefer a reliable Nepali API; if no suitable licensed API is available, use an import-and-sync pipeline into Supabase from an approved open/licensed source.
- Work is delivered one self-contained batch at a time. Continue only after the user asks.

## Batch 1 — Foundation and onboarding (complete)

- [x] Inspected the supplied design brief, PRD, HTML screens, and key screen images.
- [x] Created the Church App web project foundation.
- [x] Reworked the welcome experience for a Nepali church community.
- [x] Added a responsive sign-in interface and Nepal phone-number validation.
- [x] Established reusable design tokens, responsive layout, and reduced-motion support.
- [x] Added Nepali-first page title, description, and language metadata.
- [x] Kept the supplied database password out of source code and this tracker.
- [x] Verified the responsive app loads successfully and the production build completes.

## Batch 2 — Supabase data foundation (complete)

- [x] Connected to the supplied Church App Supabase project and confirmed it is healthy.
- [x] Added 13 application tables: profiles, private profile data, churches, memberships, fellowships, ministry roles, assignments, recaps, recap items, attendance, Bible references, songs, and favourites.
- [x] Added indexed foreign keys, data constraints, tenant checks, and safe automatic profile/church-owner triggers.
- [x] Enabled Row Level Security on every public table with 46 member, leader, administrator, and owner policies.
- [x] Explicitly granted only the required Data API operations to authenticated users; anonymous table access is revoked.
- [x] Passed the Supabase security advisor with no findings. Current performance notices only report unused indexes because the new tables are empty.
- [x] Added typed Supabase client integration and generated database types.
- [x] Added safe public environment configuration; the database password and privileged keys remain outside source control.

## Batch 2 adjustment — Temporary code-free preview access (complete)

- [x] Deferred real authentication at the user's request.
- [x] Replaced phone OTP with code-free Nepal phone-number preview access.
- [x] Added code-free Gmail-address preview access without Google OAuth or an email verification code.
- [x] Clearly labelled the flow as temporary preview access rather than secure login.
- [x] Kept temporary identity and profile details on the current device only; nothing is written to Supabase.
- [x] Preserved all Supabase RLS protections. Preview access cannot read or write protected member data.
- [x] Added a local preview reset action.
- [x] Restored real Supabase email/password authentication while retaining this flow as an explicitly separate preview-only option.

## Later batches

### Batch 3 — Home and fellowship schedule (complete)

- [x] Added a personalized Nepali home dashboard with role reminder, weekly fellowship card, quick actions, and upcoming meetings.
- [x] Added a five-item mobile navigation bar with working Home and Schedule destinations.
- [x] Added sample notifications with links back to fellowship details and the schedule.
- [x] Added list and calendar schedule views with locally relevant Nepali sample content.
- [x] Added a fellowship detail screen with location, map directions, theme, and assigned roles.
- [x] Clearly labelled all schedule and notification content as sample data while authentication is deferred.
- [x] Kept Bible, songs, volunteering, role changes, and other unfinished/protected actions disabled with explanatory feedback.
- [x] Preserved anonymous database restrictions; Batch 3 does not read or write protected Supabase data.

### Batch 4 — Nepali Bible (complete)

- [x] Reviewed key-based Scripture APIs and selected a key-free, redistribution-friendly alternative.
- [x] Verified the Nepali Unlocked Literal Bible from eBible.org/Door43 under CC BY-SA 4.0.
- [x] Added a repeatable USFM-to-JSON importer with book/verse-count validation and source documentation.
- [x] Imported all 66 books, 1,189 chapters, and 31,102 verses into per-book static reader files.
- [x] Added complete book and chapter selection across the Old and New Testaments.
- [x] Added a responsive Nepali Scripture reader with previous/next chapter navigation and adjustable text size.
- [x] Added in-book Nepali text search with direct navigation to matching verses.
- [x] Added clearly temporary, device-local verse bookmarks while authentication remains deferred.
- [x] Added copyable verse deep links using `#bible/BOOK/CHAPTER/VERSE`, ready for future recap references.
- [x] Added visible source, copyright, format-conversion, and CC BY-SA attribution.
- [x] Kept Bible delivery independent of private API keys and protected Supabase member data.
- [x] Fixed direct Bible hash routes so the reader renders correctly after profile restoration or page refresh.

### Batch 5 — Nepali worship songs (complete)

- [x] Researched Nepali Christian lyrics sites, open hymn sources, and licensed lyrics APIs; no reusable key-free Nepali catalog with clear app-redistribution permission was identified.
- [x] Added a copyright-safe alternative: six original Nepali Church App demo songs released under CC0 1.0.
- [x] Added song categories, Nepali/romanized search, result counts, and an empty-search state.
- [x] Added a responsive lyrics reader with optional chords, key/time/tempo metadata, and adjustable text size.
- [x] Added direct song hashes using `#songs/SONG-ID` and working Scripture-theme links into the Nepali Bible reader.
- [x] Added clearly temporary, device-local favourites and recap song selection while authentication remains deferred.
- [x] Added a versioned JSON catalog, automated catalog validation, licensing notes, and a protected Supabase admin-import mapping.
- [x] Kept the static demo catalog independent of private API keys and protected Supabase member data.

### Batch 5 adjustment — numbered songbook and chord transposition (complete)

- [x] Reviewed the user-supplied Scribd songbook; its page marks the 324-page upload as All Rights Reserved, so lyrics and chord arrangements were not copied.
- [x] Reviewed the supplied GitHub file; it is an app privacy policy, not a lyrics/chords dataset, and the repository does not provide a reuse license.
- [x] Extended the catalog for `भजन`, `कोरस`, or `मौलिक` sections with a required printed song number.
- [x] Added songbook section and number badges to the list and lyrics header.
- [x] Added live chord transposition from −12 to +12 semitones, key display, reset control, and octave guidance.
- [x] Added validation for unique section/number pairs and documented the permission needed for a full songbook import.
- [ ] Import the complete numbered bhajan/chorus catalog after written redistribution permission or an approved licensed source is supplied.

### Batch 5 source review — full catalog candidate (complete; awaiting permission)

- [x] Selected Christian Bhajan Chords by NM Tech as the strongest current catalog candidate based on its public listing.
- [x] Confirmed the listing reports 848 bhajan, 336 chorus, 70 child chorus, and 80 other Christian songs, with chords for most songs.
- [x] Checked the public listing and related public pages; no reusable content license, public API, or official data export was found.
- [x] Checked an AGPL-licensed multilingual hymnal code repository; it does not contain a verified Nepali catalog, and its software license would not by itself license third-party lyrics.
- [x] Added `SONG_CATALOG_PERMISSION_REQUEST.md` with the developer contacts and a ready-to-send request for written permission and an official JSON/CSV/SQL/API export.
- [ ] User sends the permission request to NM Tech and supplies the written reply/export before any catalog extraction or import.

### Batch 5 utility — public Google Play metadata scraper (complete)

- [x] Added a standalone Python scraper for the selected app's public Google Play listing metadata only.
- [x] Enforced `robots.txt`, a maximum of five top-level requests per minute, randomized delays, and three-attempt exponential backoff.
- [x] Added semantic JSON-LD/BeautifulSoup parsing with a single headless Selenium fallback for dynamic listing details.
- [x] Added structured JSON output for the app name, developer, rating, review count, installs, size, version, Android requirement, description, screenshots, and last-updated date.
- [x] Kept reviews, APK files, song lyrics, chords, and private app data explicitly outside the scraper's scope.
- [x] Live-tested the requests parser against the selected listing and documented Windows setup and usage.
- [x] Added timestamped local JSON backups and a server-only Supabase upsert utility keyed by Google Play app ID.
- [x] Added a protected `public.apps` metadata table with RLS enabled and all anonymous/authenticated access revoked.
- [x] Live-scraped the public listing through Chrome, saved the JSON backup, and upserted exactly one metadata row into Supabase.
- [x] Verified the synced listing reports version 5.1, Android 7.0+, nine screenshots, and 100K+ installs; Google Play did not publish an app-size value.
- [x] Re-ran the Supabase security advisor with no findings and verified the production build.
- [ ] Add the Supabase server secret to local `.env` only when future command-line refreshes are needed; never expose it to the browser.

### Batch 5 data audit — owner-provided Android backup (complete; authorized)

- [x] Inventoried all 31 files and 13 directories in the supplied extracted app-data folder.
- [x] Confirmed the main 20.4 MB `.db` file is actually a Flutter Hive store and is byte-identical to the accompanying `.hive` file.
- [x] Performed schema-only inspection without extracting or reproducing song text.
- [x] Corrected the structural estimate after frame-aware parsing: repeated Hive history contains four snapshots; the latest snapshot has 1,968 unique songs and 166 artists.
- [x] Confirmed the actual SQLite files contain analytics/cache data rather than worship songs.
- [x] Added `EXTRACTED_DATA_AUDIT.md` with hashes, structure, privacy findings, and a permission-gated import plan.
- [x] User confirmed on 2026-08-22 that the dataset was provided by the owner for Church App use.
- [x] Parsed, validated, and upserted the latest 1,968-song snapshot into protected Supabase catalog tables.

### Batch 5 owner catalog import (complete)

- [x] Added a reproducible Hive frame parser that selects only the latest live artists and songs snapshots.
- [x] Added normalized, idempotent import batches while excluding Android/Firebase/analytics identifiers.
- [x] Added `public.worship_artists` and extended `public.songs` for owner IDs, numbers, types, languages, three lyrics formats, chords, credits, beat, audio/video URLs, source payload, and original timestamps.
- [x] Imported 166 artists and 1,968 songs: 848 bhajans, 336 choruses, 70 children’s songs, and 714 other songs.
- [x] Verified 1,485 songs with chords, 1,254 numbered songs, zero duplicate external IDs, and zero missing titles/Nepali lyrics.
- [x] Preserved unresolved owner artist credits as text instead of dropping them.
- [x] Kept anonymous access closed, removed the temporary import endpoint, and passed the Supabase security advisor with no findings.
- [x] Added `OWNER_WORSHIP_IMPORT.md` with source hash, authorization record, counts, mapping, and safeguards.
- [x] Approved the published owner catalog for read-only access during code-free preview; church/member songs and every write operation remain protected.

### Batch 5 catalog reader — full Supabase library (complete)

- [x] Added a least-privilege anonymous RLS policy limited to published, global rows from `paurakh_owner_export_2026_08_22`.
- [x] Granted anonymous access only to normalized reader columns; the raw owner payload remains inaccessible and anonymous insert/update/delete stay revoked.
- [x] Added a `SECURITY INVOKER` paginated search RPC with literal text search, song-type filters, favourite-ID filtering, a 30-row page size, and a 50-row server cap.
- [x] Replaced the six-song static screen with the full 1,968-song Supabase catalog and load-more pagination.
- [x] Added filters for 848 bhajans, 336 choruses, 70 children’s choruses, 714 other songs, and device-local favourites.
- [x] Added direct song detail loading, owner/source notes, artist, key, beat, language, local favourites, and local recap selection.
- [x] Found 1,461 songs with inline chord-position markers and rendered them directly above the matching lyric words.
- [x] Showed positioned chords by default and preserved hide/show plus -12 to +12 semitone transposition.
- [x] Live-tested the anonymous REST/RPC boundary: catalog search and normalized lyrics succeed, raw payload access is rejected, and no anonymous writes are granted.
- [x] Passed the Supabase security advisor with no findings and completed the production build.

### Batch 6 — Members, roles, recaps, and settings (in progress)

- [x] Member directory and member profiles.
- [x] Member-facing roles and personal assignment preview.
- [x] Authenticated leader/admin role-assignment management.
- [x] Device-local recap draft and preview workflow.
- [x] Authenticated recap create/publish/archive workflow.
- [x] Authenticated fellowship attendance marking and member self-history.
- [ ] Member notifications for newly published content.
- [x] Accessibility, text-size, language, privacy, and account settings.

### Batch 6 settings — More hub and local preferences (complete)

- [x] Replaced the disabled More navigation item with a working screen from Home, Schedule, Bible, Songs, and song details.
- [x] Added a responsive profile/status card that clearly identifies code-free access as an unverified, device-local preview.
- [x] Added app-wide text-size choices from 90% to 130% with an age-based recommended-size reset.
- [x] Added an immediate high-contrast toggle and persisted both display preferences in the existing local preview profile.
- [x] Added Nepali/English preference saving while clearly noting that the full English interface is not translated yet.
- [x] Explained which information stays on the device, which authorized song data is read-only from Supabase, and which member/church data remains protected.
- [x] Added a two-step local-data removal control covering the preview profile, settings, song favourites, Bible bookmarks, and recap song selections without touching Supabase content.
- [x] Added direct `#more` restoration after refresh and updated the dashboard song shortcut from six demos to the full 1,968-song catalog.
- [x] Completed the production build.
- [x] Continued with a clearly labelled preview member directory while real authentication remains deferred.

### Batch 6 members — directory and profiles (complete)

- [x] Added a member-facing directory entry from the More hub; this is not an admin dashboard.
- [x] Added 12 explicitly fictional Nepali preview profiles spanning home fellowship, youth, worship, prayer, children’s ministry, hospitality, media, and leadership.
- [x] Added search across names, fellowships, areas, ministries, roles, and skills.
- [x] Added filters for leaders, worship, youth, and children’s ministry with live result counts and an empty state.
- [x] Kept the user’s device-local preview profile separate from the fictional directory records.
- [x] Added responsive member cards and detailed profiles with ministry, fellowship, area, participation, availability, skills, and preview-data notices.
- [x] Added direct `#members/MEMBER-ID` profile links and restored member routes after refresh.
- [x] Kept contact information, editing, and role management locked until real authentication is enabled.
- [x] Confirmed no protected Supabase member data is queried or exposed by this batch.
- [x] Completed targeted TypeScript validation and the production build.
- [x] Continued with the member-facing “My roles and assignments” experience while keeping assignment management locked.

### Batch 6 assignments — member roles and preparation (complete)

- [x] Added a member-facing “मेरो भूमिका” screen from the Home responsibility banner and More hub.
- [x] Added three clearly labelled sample ministry roles and four fictional responsibilities across prayer, worship, welcome, and Scripture reading.
- [x] Added upcoming, all, and completed filters with preparation counts.
- [x] Added detailed assignment views covering role, fellowship, date, time, area, theme, and related Bible passages.
- [x] Added an authorized-song-library shortcut for worship preparation.
- [x] Added a device-local preparation checklist with progress indicators; this preview state is removed by the existing clear-local-data action.
- [x] Added direct `#assignments/ASSIGNMENT-ID` links and restored assignment routes after refresh.
- [x] Kept acceptance, refusal, reassignment, attendance, and assignment-management actions locked until real authentication and leader authorization are available.
- [x] Confirmed this batch does not query or write protected Supabase assignments or member data.
- [x] Completed targeted TypeScript validation and the production build.
- [x] Continued with the fellowship recap draft/preview experience while keeping publish and notification actions locked.

### Batch 6 recaps — local draft and preview (complete)

- [x] Added a device-local fellowship recap builder from the More hub.
- [x] Added fellowship, meeting date, title, summary, testimony, and line-separated prayer-point fields.
- [x] Added selectable Bible references stored as deep links rather than duplicated Scripture text.
- [x] Reused the existing recap song selections from the worship reader and resolved only those authorized song IDs through the existing `SECURITY INVOKER` search RPC.
- [x] Added song removal and a direct path back to the full worship catalog for choosing more songs.
- [x] Added automatic local draft saving, an explicit save action, and `#recaps` restoration after refresh.
- [x] Added a publication-style preview at `#recaps/preview` with summary, testimony, Scripture references, songs, prayer points, and local author identity.
- [x] Kept publishing, notifications, attendance, recap history, and protected fellowship writes locked until real authentication and leader authorization are restored.
- [x] Added the recap draft to the existing clear-local-data action.
- [x] Verified anonymous song-ID resolution returns only the requested authorized catalog row and passed the Supabase security advisor with no findings.
- [x] Completed targeted TypeScript validation and the production build.
- [x] Continued with the real Supabase authentication foundation before enabling live member, assignment, recap, attendance, or notification workflows.

### Batch 6 authentication — secure account foundation (complete)

- [x] Added real Supabase email/password sign-up and sign-in as the primary access route.
- [x] Added secure session restoration, token-refresh handling, and authenticated sign-out.
- [x] Preserved code-free phone/Gmail entry only as a separately labelled, device-local preview that cannot unlock protected data.
- [x] Kept real phone-number authentication disabled until an OTP provider is configured; a typed phone number is never treated as verified identity.
- [x] Added safe sign-up confirmation handling for projects where Supabase email confirmation is enabled.
- [x] Reused the secure new-user trigger to create public and private profile rows without granting the browser privileged credentials.
- [x] Loaded authenticated profile and accessibility preferences from owner-scoped RLS rows.
- [x] Synced language, high-contrast, and text-size changes back to the authenticated user's Supabase profile with visible save status.
- [x] Aligned the private-profile text-scale constraint with the app's existing 90%–130% choices.
- [x] Confirmed anonymous roles have no profile-table access and authenticated profile writes remain RLS-scoped to `auth.uid()`.
- [x] Passed targeted TypeScript validation, ESLint, the production build, and the Supabase security advisor with no findings.
- [x] Continued with authenticated church membership and database-backed role onboarding.

### Batch 6 membership — church and invitation onboarding (complete)

- [x] Added an authenticated “मेरो मण्डली” page from the More hub with direct `#membership` restoration.
- [x] Loaded each signed-in user's active church memberships and roles from RLS-protected Supabase rows.
- [x] Added new-church creation; the existing protected trigger automatically makes the creator the active owner.
- [x] Added cryptographically random, expiring invitation codes for member or leader access with one-person or ten-person usage limits.
- [x] Stored only SHA-256 invitation hashes; plaintext codes are displayed once to the owner/administrator and never stored in Supabase, while hash columns are insert-only and not selectable through the authenticated Data API.
- [x] Added invitation redemption through an audited join-request record and a private, non-callable trigger with row locking, expiry checks, use limits, and active-member duplicate protection.
- [x] Restricted invitation creation, listing, and revocation to active owners and administrators through RLS and column-level grants.
- [x] Kept roles in database membership rows rather than editable user metadata.
- [x] Added owner/administrator invite creation, copy, usage status, expiry, and revoke controls inside the member-facing membership page; this is not a separate admin dashboard.
- [x] Added all foreign-key indexes reported by the performance advisor.
- [x] Confirmed both new tables have RLS, anonymous access is absent, authenticated grants are column-scoped, and the private redemption trigger cannot be called directly.
- [x] Passed targeted TypeScript validation, ESLint, the production build, and the Supabase security advisor with no findings.
- [ ] User acceptance test: create the first real account and exercise owner/invite/member flows; the project currently contains zero Auth users, so no test identity was created automatically.

### Batch 6 backend — membership authorization and directory API (complete)

- [x] Added database-enforced membership transition rules instead of relying on browser controls.
- [x] Protected owner memberships from direct demotion or deletion and prevented administrators from creating, modifying, or restoring owner/administrator roles.
- [x] Limited administrators to leader/member management while retaining owner control over administrator, leader, and member memberships.
- [x] Preserved secure invitation redemption for new members and inactive leader/member reactivation; inactive owner/administrator records require owner action.
- [x] Added an immutable, RLS-protected membership audit log recording the actor, target, church, operation, previous role/status, and new role/status.
- [x] Added an authenticated, `SECURITY INVOKER` same-church directory RPC with search, pagination, a 100-row cap, and only public name/avatar plus membership fields.
- [x] Kept email, phone number, date of birth, private accessibility settings, and all private profile fields out of the directory response.
- [x] Revoked direct audit-log writes and all anonymous access; private trigger functions cannot be called through the Data API.
- [x] Applied both backend migrations to Supabase, regenerated the local TypeScript surface, passed the security advisor with no findings, and completed the production build.
- [ ] Exercise owner, administrator, leader, and member transitions after real Auth test accounts exist; the project still contains zero Auth users, churches, and memberships.
### Batch 6 admin — multi-church administration route and authorization (complete)

- [x] Added a separate `#admin` route and moved church invitation management out of the member-facing `#membership` screen.
- [x] Added role-aware access gates: unauthenticated users and normal leaders/members receive a safe denial state even when opening the route directly.
- [x] Added a server-managed `platform_roles` table for the global `super_admin` role; authenticated browser users can read only their own assignment and cannot create, edit, or delete platform roles.
- [x] Added a platform super-admin view of all churches with active, suspended, and archived status controls.
- [x] Added an immutable church-status audit log and database trigger; church owners/administrators cannot change platform status.
- [x] Kept church owner/administrator controls tenant-scoped and preserved database-enforced restrictions on owner and administrator role changes.
- [x] Added `fellowship_staff` roles for coordinator, scheduler, and publisher, with composite foreign keys preventing a member or fellowship from being assigned across churches.
- [x] Added the private `can_manage_fellowship` authorization helper for future schedule/program RLS policies.
- [x] Added an RLS-enforced `list_admin_churches` API returning all churches only to super admins and assigned churches only to their owner/administrator.
- [x] Added the administration entry to the More hub only for super admins and church owners/administrators; direct-route authorization remains enforced independently.
- [x] Added `ADMIN_ARCHITECTURE.md` with the role hierarchy and safe first-super-admin provisioning steps.
- [x] Applied both migrations, added all reported foreign-key indexes, passed targeted lint, the production build, two route/render tests, and the Supabase security advisor with no findings.
- [ ] Create and confirm the intended real Auth account, then provision the first super admin using the documented trusted SQL step; the project currently has zero Auth users and zero super admins.
- [x] Continued with live church fellowship scheduling and the moderated member-preparation workflow.

### Batch 6 workflow — schedule, member preparation, and approval (complete)

- [x] Narrowed the platform super admin to church records, platform status, and aggregate counts only; removed direct RLS access to memberships, fellowships, fellowship staff, and member preparations.
- [x] Restricted platform-only super admins from editing church content fields or deleting churches; church status changes remain audited.
- [x] Reworked `list_admin_churches` through a narrow private aggregate implementation so super admins receive counts without member identities or schedule rows.
- [x] Restricted fellowship creation and deletion to church owners/administrators; explicit coordinator/scheduler staff may update only an existing fellowship schedule.
- [x] Added live fellowship creation, completion, and cancellation controls to the church-admin route.
- [x] Connected the authenticated member Schedule tab to that member's real church fellowship rows; unauthenticated preview users still receive clearly labelled fictional samples.
- [x] Kept draft fellowship schedules hidden from ordinary members while allowing church admins and assigned schedule staff to review them.
- [x] Added `fellowship_preparations` with same-church composite foreign keys, strict status checks, RLS, server-side state-transition enforcement, and review audit history.
- [x] Added the `#preparations` member route for submitting testimony, prayer, worship, Scripture, or program preparation to a selected church fellowship.
- [x] Added the church-admin moderation queue with approve/reject comments; reviewers cannot rewrite the member's title or body.
- [x] Added a church-only approved-preparation feed; submitted or rejected material is never shown in that feed.
- [x] Added `SECURITY INVOKER` APIs for the member's own history, the approved church feed, and the church-admin review queue.
- [x] Added the missing composite foreign-key indexes and confirmed the performance advisor no longer reports unindexed foreign keys.
- [x] Found and corrected missing authenticated execution grants for private boolean helpers referenced by RLS.
- [x] Ran a rollback-only database authorization test proving: submitted content is hidden, admin approval publishes it to the same church, and a platform-only super admin receives church aggregates but zero membership or fellowship rows.
- [x] Updated the local Supabase type surface, passed targeted ESLint, the production build, three route/workflow tests, and the Supabase security advisor with no findings.
- [ ] User acceptance test: create an owner and member account, create one fellowship, submit one preparation, approve it in `#admin`, and confirm it appears in `#preparations`; the project still has zero real Auth users and no sample church was created.
- [ ] Next batch: authenticated member-role assignment plus real assignment, recap, attendance, and notification workflows.

### Batch 6 assignments — live ministry roles and responsibilities (complete)

- [x] Added church-admin assignment controls inside `#admin` for selecting a fellowship, active same-church member, ministry role, and preparation note.
- [x] Connected the member-facing `#assignments` route to real RLS-protected Supabase assignments for authenticated users; unauthenticated preview users still receive only clearly labelled fictional samples.
- [x] Added member accept and decline responses, plus church-admin completion and removal controls.
- [x] Added a church-scoped assignment roster so administrators can see each assigned member's response without exposing assignments across churches.
- [x] Added database-enforced assignment transitions, immutable tenant/member/fellowship identity fields, validation checks, and an audit history for assigned, accepted, declined, completed, updated, and removed events.
- [x] Added `SECURITY INVOKER` APIs for a member's own assignments and a manager's fellowship assignment roster.
- [x] Kept platform-only super admins outside assignment rows, member identities, and fellowship content; they remain limited to church management and aggregate counts.
- [x] Ran a rollback-only authorization test proving: the assigned member can accept, another same-church member cannot read the assignment, the church admin sees the response and can complete it, the audit records the lifecycle, and a platform-only super admin receives zero assignment rows.
- [x] Applied the migration, updated the local TypeScript surface, passed targeted ESLint, the production build, four route/workflow tests, and the Supabase security advisor with no findings.
- [x] Confirmed the performance advisor reports no missing foreign-key indexes or other important findings.
- [ ] User acceptance test: create an owner and member account, create one fellowship, assign a ministry role in `#admin`, accept it in `#assignments`, and complete it in `#admin`; the project still contains zero Auth users, churches, fellowships, and assignments.
- [ ] Next batch: authenticated recap publication, attendance, or member notification workflow. Choose one before implementation.

### Batch 6 recaps — authenticated publication and member feed (complete)

- [x] Added a church-admin recap publisher inside `#admin`, tied to one real same-church fellowship.
- [x] Added Supabase-backed recap drafts with title, summary, testimony, prayer points, Bible route references, and authorized worship-catalog song identifiers.
- [x] Added database-enforced `draft → published → archived` transitions; a new recap cannot begin as published and published content is immutable.
- [x] Added member-facing published recap cards and direct `#recaps/RECAP-ID` reading routes for authenticated users; unauthenticated preview users retain the clearly labelled device-local draft experience.
- [x] Added Bible deep links and worship-song detail links without duplicating licensed Bible or song text in recap rows.
- [x] Added `SECURITY INVOKER` APIs for the church member feed and the authorized publisher management list.
- [x] Added immutable `recap_publication_audit` history and revoked browser write access to audit rows.
- [x] Kept platform-only super admins outside recap rows, recap audit rows, fellowship content, and member identities.
- [x] Ran a rollback-only authorization test proving: the church owner can publish, the same-church member sees one feed item, an unrelated user sees zero rows, the platform-only super admin sees zero recap/audit rows, and the two expected audit events are recorded.
- [x] Applied both recap migrations, added the reported composite foreign-key index, and confirmed the performance advisor has no missing foreign-key indexes or important findings.
- [x] Passed targeted ESLint, the production build, five route/workflow tests, and the Supabase security advisor with no findings.
- [ ] User acceptance test: create an owner and member account, create one fellowship, publish its recap in `#admin`, and confirm the member sees it at `#recaps`; the project still contains zero Auth users, churches, fellowships, recaps, and recap audit rows.
- [x] Continued with authenticated fellowship attendance and member self-history.

### Batch 6 attendance — admin roster and member self-history (complete)

- [x] Added a fellowship attendance roster inside `#admin` for church owners/administrators and explicitly assigned fellowship coordinators.
- [x] Added attended, missed, excused, and not-yet-marked states, optional notes, roster search, and live attendance totals.
- [x] Added the authenticated member route `#attendance`, showing only that signed-in member's recorded attendance history across their selected church.
- [x] Removed member attendance writes: members have read-only access to their own history, while database RLS and triggers restrict marking, editing, and removal to an authorized attendance manager.
- [x] Required every marked member to have an active membership in the fellowship's church and protected the church, fellowship, member, and creation identity fields from later changes.
- [x] Added immutable `attendance_audit` events for marked, changed, and removed records; browser clients cannot write audit rows.
- [x] Kept platform-only super admins outside attendance rows, audit rows, member identities, and fellowship rosters.
- [x] Ran a rollback-only authorization test proving: the owner sees all three active roster members and two audit events, the marked member sees one own history row but cannot edit it, another same-church member sees zero rows, and the platform-only super admin sees zero attendance/audit rows.
- [x] Applied the attendance migration, updated the local TypeScript surface, passed targeted ESLint, the production build, six route/workflow tests, and the Supabase security advisor with no findings.
- [x] Confirmed the performance advisor reports only expected unused-index informational notices on this empty project, with no missing foreign-key index or other important finding.
- [ ] User acceptance test: create an owner and member account, create one fellowship, mark attendance in `#admin`, and confirm the member sees it at `#attendance`; the project still contains zero Auth users, churches, fellowships, attendance rows, and attendance audit rows.
- [x] Continued with authenticated in-app member notifications for schedules, assignments, preparation decisions, recaps, and attendance changes.

### Batch 6 authorization correction — distinct roles and responsibility-scoped posting (complete)

- [x] Audited the three real test accounts and confirmed none was a platform super admin; each had independently created a church and become its owner through the former self-service church flow.
- [x] Removed self-service church creation from normal member onboarding and revoked direct authenticated `churches` inserts.
- [x] Added a super-admin-only church provisioning workflow that requires the exact confirmed email of a different normal account and assigns that account as the initial owner/main church administrator.
- [x] Enforced mutual exclusion between `platform_roles.super_admin` and active church `owner`/`admin` memberships with database triggers and row locking.
- [x] Preserved super-admin platform-only scope: church registration, status, and aggregate counts without church membership or content access.
- [x] Hid preparation posting from unassigned ordinary members and limited their fellowship list to active `assigned`/`accepted` responsibilities.
- [x] Kept preparation posting available to church owners, administrators, leaders, and explicitly assigned fellowship coordinators/schedulers/publishers; Supabase enforces the same rule on direct writes.
- [x] Added `ROLE_ACCOUNT_SETUP.md` with separate super-admin, church-admin, member, and Chrome-profile testing instructions.
- [x] Fixed protected initial-owner provisioning and parent-church cascade deletion without allowing direct owner-membership deletion.
- [x] With user authorization, deleted all three previously created Auth accounts, sessions, churches, and dependent rows; the project now has zero Auth users, profiles, platform roles, churches, memberships, fellowships, and preparation posts.
- [x] Ran a rollback-only authorization test proving separate super-admin/church-admin accounts, blocked normal church creation, blocked cross-role promotion, hidden unassigned-member posting, assigned-member posting, and always-visible leader posting.
- [x] Passed targeted ESLint, the production build, eight route/workflow tests, and the Supabase security advisor with no findings.
- [ ] User acceptance test: follow `ROLE_ACCOUNT_SETUP.md` to create one dedicated platform account, one separate church-admin account, and one member account; assign a responsibility and confirm posting appears only for the assigned member.
- [x] Continued with authenticated in-app member notifications.

### Batch 6 notifications — church-scoped, role-aware workflow inbox (complete)

- [x] Replaced the static notification preview with an authenticated Supabase-backed inbox at `#notifications`.
- [x] Added persistent per-recipient notifications for new assignments, approved/rejected preparations, published recaps, schedule creation/changes/cancellation, and attendance marking/changes/removal.
- [x] Limited assignment and attendance events to the affected member, preparation decisions to the author, and schedule/recap events to active same-church members while excluding the actor.
- [x] Kept platform-only super admins outside all church notification rows and linked every recipient to an active same-church membership with RLS plus a composite foreign key.
- [x] Allowed browser clients to read only their own notifications and update only `read_at`; direct notification creation, content editing, and deletion remain blocked.
- [x] Added an unread badge, all/unread filters, mark-one and mark-all-read actions, church labels, refresh-on-focus, and deep links to assignments, preparations, recaps, schedule, and attendance.
- [x] Added `list_my_notifications` and `notification_unread_count` APIs and updated the local TypeScript database surface.
- [x] Applied migration `20260824043834_role_aware_in_app_notifications.sql` to Supabase.
- [x] Ran a rollback-only authorization test proving the target member received exactly eight expected event notifications, the owner/actor received zero, an unrelated church user received zero, a platform-only super admin received zero, one read update reduced unread count from eight to seven, and direct browser notification insertion was blocked.
- [x] Passed targeted ESLint, the production build, all nine route/workflow tests, and the Supabase security advisor with no findings.
- [x] Confirmed the performance advisor reports only expected unused-index informational notices on the still-empty project; no missing foreign-key index or important performance finding was introduced.
- [ ] User acceptance test: after creating the separate accounts described in `ROLE_ACCOUNT_SETUP.md`, trigger each workflow and confirm the member sees the notification at `/#notifications` and the deep link opens the correct screen.
- [ ] Next batch: exercise all roles with real accounts, complete mobile/desktop accessibility review, or choose the next backend module.

### Batch 6 fellowship program — worship/Scripture slides and private notebook (complete)

- [x] Added the fellowship-specific `#service/FELLOWSHIP-ID` route from the member schedule, church-admin schedule, and assigned worship/preaching responsibility screens.
- [x] Added one ordered program deck per fellowship: worship preparers select authorized Bhajan/Chorus songs by number or title and place them into opening, worship, response, or closing sections without copying the catalog rows; members can transpose displayed chords from −12 to +12 semitones.
- [x] Added preacher preparation for the main sermon topic, summary, and ordered Nepali Bible chapter/verse slides; published slides load the actual prepared passage from the existing local Nepali Bible source.
- [x] Limited worship slide editing to an assigned worship member or program manager, sermon editing to an assigned preacher or program manager, and publishing/reopening to the church program manager.
- [x] Required a topic, at least one song, and at least one Scripture passage before publication; published programs are immutable until a manager explicitly reopens the draft.
- [x] Added a member-private fellowship notebook with a 20,000-character written reflection, highlights only from prepared published passages, optional highlight reflections/colors, and per-member deletion.
- [x] Added microphone recording for members who have difficulty typing, capped at five minutes and 10 MB per clip. Audio bytes use the private `member-voice-notes` Supabase Storage bucket and consume Storage quota; PostgreSQL stores only protected metadata.
- [x] Added one-hour signed playback URLs and owner-only Storage paths shaped as `USER-ID/CHURCH-ID/FELLOWSHIP-ID/OBJECT-ID.ext`; other members, church admins, outsiders, and platform super admins cannot read a member's notebook or voice files.
- [x] Applied migrations `20260824045824_fellowship_service_slides_and_member_notebook.sql` and `20260824052500_fellowship_service_fk_indexes.sql` to Supabase.
- [x] Ran a rollback-only authorization test proving distinct worship/preacher capabilities, manager-only publication, two-slide member access, rejection of highlights outside the prepared passage, complete private notebook isolation, private Storage isolation, and zero access for outsiders/platform super admins; all temporary data and Storage objects rolled back to zero.
- [x] Passed the production build and all ten route/workflow tests. Targeted lint has no finding in this batch's files; the full lint command retains six pre-existing React effect errors and one pre-existing dependency warning in the Bible, recap, and worship screens.
- [x] Confirmed the Supabase security advisor has no findings and added all six foreign-key covering indexes reported by the performance advisor. Only expected unused-index informational notices remain on the empty project.
- [ ] User acceptance test: create the separate accounts in `ROLE_ACCOUNT_SETUP.md`, schedule one fellowship, assign worship and preaching, prepare/publish its deck, and verify private written/highlight/voice notes from two different member accounts.
- [ ] Next batch: add drag/reorder controls for an existing deck, notify preparers/members when the deck is published or reopened, or continue final mobile/accessibility QA.

### Batch 6 projector PowerPoint generator (complete; current stopping point)

- [x] Added a fellowship-specific “PowerPoint डाउनलोड” button for published programs and for authorized preparers previewing a draft.
- [x] Generates an editable widescreen `.pptx` locally in the member's browser from the already-authorized ordered song and Scripture content; church content is not submitted to an external presentation service.
- [x] Builds a minimal title slide, one or more slides per song/passage, and a closing application slide using the fellowship title, date, sermon topic, preacher, song numbers/titles/lyrics, Bible references, and prepared Nepali verse text.
- [x] Removes inline musician chord markers from congregation-facing lyrics and automatically splits long lyrics after four lines/about 210 characters and Scripture after two verses/about 330 characters.
- [x] Uses projector typography of 46–54 pt for primary headings, about 32–40 pt for song/verse content, and a controlled reduction to 26–30 pt only for unusually long Scripture text.
- [x] Selects one of four licensed Unsplash backgrounds by keywords such as worship/praise, Bible/word/light, or faith/hope/peace; a dark contrast layer protects readability, and a matching solid-color fallback keeps generation working if the image request fails.
- [x] Adds visible photo credit plus `[Sources]` notes containing the exact Unsplash asset page and license context on every image-backed slide.
- [x] Added `pptxgenjs` as a lazily loaded browser dependency so the main church UI does not load the PowerPoint generator until the member presses the button.
- [x] Generated `examples/fellowship-projector-reference.pptx`, checked all six representative projector layouts individually at 1280×720, and confirmed no clipping, overlap, or low-contrast text in the reference design.
- [x] Attempted the Presentations skill's required artifact renderer exactly once. Its bundled Windows `skia-canvas` native module cannot load on this machine, so the fallback QA used the same PptxGenJS composition plus full-size Chrome renders; this does not affect the app's browser PowerPoint download.
- [x] Passed targeted ESLint for the new presentation generator and confirmed TypeScript reports no new generator/service errors; remaining typecheck failures are pre-existing Cloudflare ambient types and one existing worship-song nullability issue.
- [ ] User acceptance test: publish a real fellowship program, open `#service/FELLOWSHIP-ID`, press “PowerPoint डाउनलोड,” and project the downloaded `.pptx` in PowerPoint or LibreOffice Impress.
- [ ] Next batch: optional church-branded theme/logo controls, an offline background-image pack, or program slide reordering.

### Batch 7 — Final QA and release

- [x] Restore real authentication before enabling protected member features.
- [x] Add church membership onboarding and secure invitations.
- [ ] Exercise member, leader, administrator, and owner authorization paths with real test accounts.
- [ ] End-to-end mobile and desktop review.
- [ ] Accessibility, permission, data integrity, and security checks.
- [ ] Production data migration, deployment, and handoff notes.

### Batch 7 member onboarding — church choice, approval, and private signup profile (complete)

- [x] Added complete secure-account signup fields for date of birth, Nepal phone, gender, permanent address, and temporary/current address with a “same as permanent” option.
- [x] Kept these fields in the owner-only `profile_private` record and out of the same-church member directory response.
- [x] Added a limited active-church catalog to signup and `#membership`; choosing a church creates a pending ordinary-member request and never grants elevated authority.
- [x] Added pending/approved/rejected request history for each member, including the optional administrator review note.
- [x] Added a same-church owner/admin approval queue at `#admin`; approval atomically activates a `member` membership, while rejection creates no membership.
- [x] Preserved invitation codes as the immediate trusted activation path for explicit member/leader invitations.
- [x] Replaced the fictional member preview with the real `list_church_members` directory, fixing the case where Simran had an active Test-church membership but was hidden by placeholder data.
- [x] Applied `20260824122500_member_church_application_onboarding.sql` and the private implementation/public invoker hardening migration `20260824131000_joinable_church_catalog_security_wrapper.sql`.
- [x] Ran a rollback-only end-to-end database test proving pending request → owner approval → ordinary member membership → directory visibility, with private address storage and zero leftover test rows.
- [x] Passed targeted ESLint, the production build, and all 11 route/workflow tests. Security advisor findings introduced by the public church catalog were removed; only the project-level leaked-password-protection setting remains disabled.
- [ ] User acceptance test: sign up a new member, choose **Test**, approve from the Test church admin at `#admin`, then confirm the member appears at `#members`.
- [ ] Next batch: account profile editing, controlled member-role promotion, or full multi-role mobile/desktop acceptance testing.

## Decisions and safeguards

- Supabase database password must never be exposed in browser bundles, committed files, screenshots, or logs.
- Code-free phone/Gmail access is development preview behavior only and must never be described as verified authentication.
- Anonymous database access is limited to read-only normalized fields for the published owner-authorized worship catalog; protected member/church data, raw import payloads, and all writes remain revoked.
- WhatsApp OTP will not be enabled as a “free” method because Supabase supports that channel through paid Twilio/Twilio Verify messaging.
- Nepali Bible and worship lyrics must be used only with permission or a license that allows app distribution.
- Recaps store references to Bible passages and songs rather than duplicating their text.
- Each batch is implemented and reviewed before work starts on the next batch.

### Local preview repair (complete)

- [x] Replaced the Windows local `pnpm dev` path with a lightweight vinext/Vite preview that does not start the unstable Miniflare child process.
- [x] Preserved the Cloudflare-specific local runner as `pnpm dev:cloudflare` for environment testing.
- [x] Confirmed the local preview serves the interactive Church App and its JavaScript assets from the same process.

### Batch 8 monorepo foundation — Fastify, Drizzle, Expo, and Tamagui (complete; current stopping point)

- [x] Preserved the current web/Supabase application as a working migration source and added parallel `apps/api`, `apps/mobile`, and `packages/database` workspaces.
- [x] Translated the current business model into one declarative Drizzle PostgreSQL schema with 28 tables, constrained enums, foreign keys, church-scoped indexes, inferred shared types, and a generated SQL migration.
- [x] Added a modular Fastify server with configuration validation, pooled PostgreSQL access, CORS, global error handling, JWT authentication, salted scrypt passwords, short access tokens, hashed rotating refresh sessions, and role guard helpers.
- [x] Migrated the complete signup and church-membership approval vertical slice to REST: public active-church catalog, detailed private profile registration, pending ordinary-member requests, church-admin approval/rejection, and privacy-safe member directory.
- [x] Prevented signup from granting owner/admin/super-admin roles and separated platform super-admin authority from church membership roles.
- [x] Added an Expo Router mobile foundation using Tamagui-only UI primitives, design tokens, native light/dark themes, React Query server caching, Zustand session state, and Expo SecureStore token persistence.
- [x] Built the premium responsive Nepali signup/church-choice screen with 44px+ controls, validation, loading/error states, same-address behavior, and pending-approval explanation.
- [x] Removed the blocked native Argon2 build dependency and used Node's built-in cryptographic scrypt implementation with random salts and timing-safe comparison.
- [x] Added `MONOREPO_MIGRATION.md`, environment examples, local commands, and an explicit no-cutover safety boundary.
- [x] Passed database, API, and mobile strict TypeScript checks; generated the 28-table Drizzle SQL migration and passed the Fastify health test.
- [x] Aligned Expo native dependencies to the SDK compatibility matrix, produced successful Android JavaScript and web production exports, and visually verified the Tamagui signup screen with no browser warnings or errors. Hermes bytecode compilation remains delegated to EAS/Linux because the local Windows Hermes compiler crashes on the large bundle.
- [x] Added a Windows/OneDrive-safe Metro resolver for generated type-only/no-op package files that Metro's file map omits, without replacing any application runtime logic.
- [x] Added platform-safe session persistence: encrypted Expo SecureStore on Android/iOS and localStorage only for the web preview.
- [x] Added `CLIENT_DEMO_GUIDE.md`; the existing complete app remains the recommended client demo while the new custom PostgreSQL environment is awaiting provisioning.
- [ ] User action: provision the custom PostgreSQL database and provide its private `DATABASE_URL`; do not place it in frontend code or commit it.
- [x] Corrected the Expo visual direction to mobile-first: a 480px content ceiling, compact 12–26px typography scale, tighter 16px cards, single-column phone fields, and 44px-or-larger touch targets.
- [x] Rebuilt the Expo home screen as a compact Tamagui dashboard with a phone-native header, focused hero, and two-column quick actions instead of oversized web-style components.
- [x] Kept every screen primitive inside Tamagui (`YStack`, `XStack`, typography, inputs, buttons, switches, and tokens); no raw React Native `View`, `Text`, or `TouchableOpacity` components were introduced.
- [x] Verified the registration screen at a 390×844 viewport, including gender selection and the same-address switch, and produced successful Expo web and Android production exports.
- [x] Aligned the mobile workspace to Expo SDK 54 for compatibility with the public physical-iPhone Expo Go client; verified the live manifest reports `SDKVersion 54.0.0` and `runtimeVersion exposdk:54.0.0`.
- [x] Fixed the Expo Go `createTamagui() missing` render failure by resolving Tamagui core/web through one canonical Metro module instance and initializing the config before Expo Router evaluates screens.
- [ ] Next batch: migrate fellowship scheduling, assignments, preparation approvals, and role-aware notifications to Fastify/React Query/Tamagui. A separate web-specific redesign remains deferred until the mobile experience is complete.
