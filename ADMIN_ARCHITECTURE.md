# Church App administration architecture

Last updated: 2026-08-24

## Role hierarchy

1. **Platform super admin** — a server-managed `public.platform_roles` row. This role registers churches, assigns a separate initial church administrator, and sees church records, platform status, and aggregate member/fellowship counts. It cannot hold an active church owner/administrator membership or read church member/content rows.
2. **Main church administrator / administrator** — an active `public.memberships` row scoped to one church. The internal `owner` role is displayed as “main church administrator.” Owners and administrators open `#admin` for that church, manage invitations and fellowship schedules, approve or reject member preparation, assign ministry roles, publish fellowship recaps, and mark fellowship attendance.
3. **Church leader / member** — an active membership row with normal member access. These users cannot open administrative controls.
4. **Fellowship coordinator / scheduler / publisher** — a `public.fellowship_staff` row tied to both one active church membership and one fellowship. Coordinators can manage the assigned fellowship schedule and program content, schedulers can manage only its schedule, and publishers can manage only its program content. This does not grant church-wide administration.

All boundaries are enforced by Supabase Row Level Security, database triggers, and composite foreign keys. Hiding a button is not treated as authorization.

## First super-admin setup

No super-admin account is created automatically. Use a dedicated account that has no active church owner/administrator membership. After the intended person has created and confirmed that real Supabase Auth account:

1. Open **Supabase Dashboard → Authentication → Users** and copy that user's UUID.
2. Open **SQL Editor** using the trusted project-owner account.
3. Replace the placeholder UUID and run:

```sql
insert into public.platform_roles (user_id, role)
values ('PASTE-AUTH-USER-UUID-HERE', 'super_admin')
on conflict (user_id) do update set role = excluded.role;
```

4. Ask that user to sign out and sign in again, then open `/#admin`.

Do not add a browser form for creating super admins, and never place a service-role/secret key in frontend code.

After the first super admin signs in, that user registers a church through the protected provisioning form in `#admin` and enters a different confirmed account's exact email. PostgreSQL creates the church and assigns that separate account as its initial owner/main church administrator. Ordinary sign-up never creates a church or grants a role. See `ROLE_ACCOUNT_SETUP.md` for the complete account sequence.

## Church status

The platform statuses are `active`, `suspended`, and `archived`. Only a platform super admin can change them. Each change records the actor, previous status, new status, and timestamp in `public.church_status_audit`.

## Member preparation publication

1. A church owner/administrator/leader, an assigned fellowship staff member, or an ordinary member with an `assigned`/`accepted` responsibility selects an authorized fellowship through `#preparations`.
2. PostgreSQL stores it as `submitted`; it is visible only to its author and that church's owner/administrators.
3. A church owner/administrator approves or rejects it from `#admin`. Reviewers can add a note but cannot rewrite the member's content.
4. Approval sets the reviewer, review time, and publication time inside a protected trigger.
5. Only `approved` rows are returned by the church feed, and only to active members of that same church.

The posting entry is hidden for an unassigned ordinary member, and the database independently rejects direct writes. Leaders receive church-wide fellowship posting choices; fellowship staff and assigned members receive only the fellowships covered by their post or responsibility. Every status change is recorded in `public.preparation_review_audit`. Platform super admins have no implicit access to the queue, audit rows, or published church feed.

## Ministry role assignment lifecycle

1. A church owner/administrator selects a fellowship, active same-church member, ministry role, and optional preparation note in `#admin`.
2. PostgreSQL creates the assignment as `assigned`. The member sees it in `#assignments` and may accept or decline it.
3. The church owner/administrator sees the response in the fellowship roster. An accepted assignment may be marked `completed`, and an assignment may be removed when appropriate.
4. Database triggers protect church, fellowship, member, and role identity fields and enforce the permitted status transitions.
5. Assignment events are written to `public.assignment_audit`; browser clients cannot insert, edit, or delete audit rows directly.

Members can read only their own assignments. Church managers receive only the roster for fellowships they are authorized to manage. A platform-only super admin has no implicit access to assignments, members, or fellowship content.

## Fellowship recap publication

1. A church owner/administrator selects one real fellowship in `#admin` and saves a recap draft containing a summary, optional testimony, prayer points, Bible route references, and authorized worship-song identifiers.
2. A protected trigger requires every new recap to begin as `draft` and permits publication only through church-admin or fellowship program-publisher authority.
3. Publication sets the authenticated publisher and timestamp in PostgreSQL. Published content is immutable and may only remain published or move to `archived`.
4. Active members of the same church read published recaps through `#recaps`; drafts and archived rows are excluded from the member feed.
5. Created, updated, published, archived, and deleted events are written to `public.recap_publication_audit`. Browser clients cannot write audit records.

Bible and song text is not copied into recaps. Recaps store only Bible reader route references and owner-authorized worship-catalog identifiers. Platform-only super admins have no implicit access to recap content or audit rows.

## Fellowship attendance

1. A church owner/administrator or the fellowship's assigned coordinator opens the attendance roster in `#admin`.
2. The roster contains only active members of that fellowship's church. The manager records `attended`, `missed`, or `excused`, with an optional note; removing a mark returns the member to the unmarked state.
3. PostgreSQL verifies the manager's fellowship authority and the member's active same-church membership on every write. Church, fellowship, member, and creation identity fields cannot be reassigned later.
4. An authenticated member opens `#attendance` and receives only their own recorded history for the selected active church. Member attendance is read-only.
5. Marked, changed, and removed events are written to `public.attendance_audit`; browser clients cannot write audit records.

Platform-only super admins have no implicit access to attendance, attendance audits, member identities, or fellowship rosters.

## In-app notifications

Protected database triggers create one persistent notification per intended recipient:

- a new assignment goes only to the assigned member;
- an approved or rejected preparation goes only to its author;
- a published recap or schedule change goes to active members of that church, excluding the actor;
- an attendance mark, change, or removal goes only to the affected member.

Each row carries one `church_id` and one recipient whose active membership must belong to that same church. Members can select only their own notification rows through RLS and can update only `read_at`. They cannot create, rewrite, or delete notifications. An inactive membership immediately loses read access, deleting the membership removes its notifications, and a platform-only super admin receives no church-content notifications.

The app exposes this inbox at `#notifications`, displays the unread count in the header, and deep-links each event to its protected assignment, preparation, recap, schedule, or attendance screen. The inbox refreshes when opened or when the app regains focus; it is an in-app record, not SMS, email, WhatsApp, or operating-system push delivery.

## Fellowship worship and preaching program

Each fellowship can have one ordered program at `#service/FELLOWSHIP-ID`. The program references the existing authorized worship catalog instead of copying lyrics/chords, renders inline chords over their lyric positions, and lets members transpose them from −12 to +12 semitones. Scripture slides store only the selected book, chapter, and verse range and load the Nepali passage from the app's Bible source.

Preparation authority is separated by responsibility:

- an assigned worship member can add or remove Bhajan/Chorus slides but cannot edit sermon content;
- an assigned preacher can set the main topic/summary and add or remove prepared Scripture passages but cannot edit worship songs;
- a church owner/administrator or authorized program manager can manage both areas and is the only role that may publish or reopen the program;
- an active same-church member sees the shared deck only after publication; outsiders and platform super admins do not receive church content.

Publication requires a main sermon topic, at least one worship song, and at least one Scripture passage. A published program is immutable until a program manager returns it to draft.

Every active same-church member receives a separate private notebook for a published program. Written reflections, prepared-passage highlights, and voice-note metadata are protected by user-scoped RLS; not even the church administrator can read another member's notebook. Voice bytes are stored in the non-public `member-voice-notes` Supabase Storage bucket with a maximum of 10 MB and five minutes per clip. Paths include user, church, and fellowship identifiers, playback uses short-lived signed URLs, and recordings consume the project's Supabase Storage quota rather than PostgreSQL table space.

## Projector PowerPoint generation

Published fellowship programs expose a `PowerPoint डाउनलोड` action to active same-church members. Authorized worship/preaching preparers and program managers may also generate a draft preview. The browser lazily loads the generator and constructs an editable 16:9 `.pptx` locally; no song, Scripture, sermon, or member data is sent to an external presentation-generation service.

The deck uses the prepared program order. Song lyrics are stripped of musician-only inline chord markers and split into projector-safe groups of at most four lines/about 210 characters. Prepared Scripture is split into groups of at most two verses/about 330 characters. Primary headings use 46–54 pt type and normal congregation content uses roughly 32–40 pt, with a guarded reduction only for unusually long verses.

A deterministic keyword selector chooses among licensed Unsplash worship, Bible, Scripture, and peaceful-nature assets using the song title/lyrics or sermon/passage context. Each image receives a dark contrast overlay, visible creator credit, and a `[Sources]` block in the PowerPoint notes containing its exact Unsplash page. If an image cannot load, the same slide uses its coordinated solid-color fallback and still downloads successfully. The external request therefore contains only the chosen public image URL, never church content.
