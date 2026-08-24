# Church App role account setup

Last updated: 2026-08-24

This guide explains how to create and test separate platform super-admin, church-admin, and member accounts. Creating a Supabase Auth user—whether from the Church App or the Supabase Dashboard—creates only a normal authenticated account. It does not grant any application role.

## Role boundaries

| Account | Database authority | What the account can do |
| --- | --- | --- |
| Platform super admin | One server-managed `public.platform_roles` row with `role = 'super_admin'` | Register churches, assign each church's first administrator, view church status and aggregate counts, suspend or archive a church |
| Main church administrator | One active `public.memberships` row with `role = 'owner'` | Manage one church's administrators, members, invitations, fellowships, approvals, assignments, recaps, and attendance |
| Additional church administrator | One active `public.memberships` row with `role = 'admin'` | Manage the permitted church workflows without platform access or owner-only authority |
| Leader/member | One active membership row with `role = 'leader'` or `member` | Use member screens and submit or prepare content within the assigned church |

One account cannot be both a platform super admin and an active church owner/administrator. PostgreSQL rejects that combination even if a browser control is bypassed.

## Recommended account order

### 1. Create a dedicated platform account

Create a new account that will never be used as a church member or church administrator.

You can create it in either place:

- Church App: open `http://127.0.0.1:3000/#more`, choose the real email/password account option, and sign up.
- Supabase Dashboard: open **Authentication → Users → Add user**, enter the dedicated email and a strong password, and ensure the email is confirmed.

Creating the Auth account does not make it a super admin. Copy its UUID from **Authentication → Users**, open the trusted **SQL Editor**, and run:

```sql
insert into public.platform_roles (user_id, role)
values ('PASTE-DEDICATED-AUTH-USER-UUID-HERE', 'super_admin');
```

The insert will fail if that account is already an active church owner or administrator. This is intentional. Sign out and sign in again after provisioning, then open:

`http://127.0.0.1:3000/#admin`

### 2. Create the main church-administrator account

Create and confirm a different normal Auth account. Do not insert this account into `platform_roles`.

Sign in as the platform super admin, open `#admin`, and use **“मण्डली र मुख्य प्रशासक दर्ता”**. Enter:

1. The church name.
2. Optional Nepali name and address.
3. The exact confirmed email of the church-administrator account.

The protected database function creates the church and adds that different account as the active `owner`, displayed in the app as **मुख्य मण्डली प्रशासक**. The super admin does not become a church member.

The church administrator can then sign in and open:

`http://127.0.0.1:3000/#admin`

They see only their assigned church and its church-level management tools. They cannot see platform controls or other churches.

### 3. Create a member account

Create and confirm another normal Auth account. It initially has no church membership and no administration access.

1. Sign in as the church administrator and open `#admin`.
2. Generate a **member** or **leader** invitation code.
3. Sign out and sign in as the new member.
4. Open `http://127.0.0.1:3000/#membership`.
5. Redeem the invitation code.

The member can use church content and their own assignments, preparations, recaps, and attendance. Opening `#admin` returns an authorization-denied screen.

## Testing multiple accounts in Chrome

Supabase keeps one active session per browser profile for this app. Use one of these methods:

- Recommended: create three Chrome profiles named **Platform**, **Church Admin**, and **Member**.
- Or use one normal window and separate Incognito windows, signing out before reusing a window.
- Do not test two roles in different tabs of the same Chrome profile; both tabs share the same Supabase session.

Suggested test URLs:

- Platform super admin: `http://127.0.0.1:3000/#admin`
- Church administrator: `http://127.0.0.1:3000/#admin`
- Member membership: `http://127.0.0.1:3000/#membership`
- Member attendance: `http://127.0.0.1:3000/#attendance`

## Clean restart completed

The 2026-08-24 audit found three confirmed Auth accounts and zero `platform_roles` rows. Each account had created a separate church and was therefore an `owner`; none was a true platform super admin. With the project owner's approval, all three accounts, sessions, churches, and dependent membership data were deleted after the corrected role rules were deployed.

The project now has zero Auth users, profiles, platform roles, churches, memberships, fellowships, and preparation posts. Start with step 1 above and create a dedicated platform account first.

## Preparation-post visibility

- A church `owner`, `admin`, or `leader` sees the preparation-post option for active fellowships.
- A fellowship coordinator, scheduler, or publisher sees posting for the fellowship where that post is assigned.
- An ordinary member sees posting only for a fellowship where an assignment is currently `assigned` or `accepted`.
- An unassigned ordinary member does not see the posting entry in the More screen. Opening the direct route does not reveal a posting form, and Supabase rejects a direct insert.
- All active church members may still read approved church-feed content that their membership already permits.

## Security rules

- Never put the service-role key or database password in frontend code.
- Never store role authorization in user-editable `user_metadata`.
- Do not manually make every Auth user a super admin.
- Use the super-admin provisioning form for new churches and church administrators.
- Use church invitation codes for leaders and members.
- Sign out and back in after a trusted role change so the application reloads the current authorization state.
