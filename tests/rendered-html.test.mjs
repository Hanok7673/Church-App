import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Church App session shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ne">/i);
  assert.match(html, /<title>Church App \| नेपाली मण्डली<\/title>/i);
  assert.match(html, /class="phone-shell auth-session-loading"/i);
  assert.match(html, /सुरक्षित सत्र जाँच्दै…/);
  assert.match(html, />Church App</);
  assert.doesNotMatch(html, /SUPABASE_SERVICE_ROLE_KEY|service_role_key/i);
});

test("keeps administration on a separate role-gated route", async () => {
  const [churchApp, dashboard, admin, membership, moreSettings] = await Promise.all([
    readFile(new URL("../app/church-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/church-membership.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/more-settings.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(churchApp, /hash\.startsWith\("#admin"\)/);
  assert.match(churchApp, /client\.from\("platform_roles"\)/);
  assert.match(dashboard, /props\.screen === "admin"/);
  assert.match(dashboard, /<AdminDashboard/);
  assert.match(admin, /client\.rpc\("list_admin_churches"\)/);
  assert.match(admin, /!hasAdminAccess/);
  assert.match(admin, /selectedChurch\.my_role !== "super_admin"/);
  assert.match(admin, /changeChurchStatus/);
  assert.match(membership, /onNavigate\("admin"\)/);
  assert.doesNotMatch(membership, /function generateInvite/);
  assert.match(moreSettings, /profile\.isSuperAdmin/);
  assert.match(moreSettings, /onNavigate\("admin"\)/);
});

test("connects member preparation submission to church-admin moderation", async () => {
  const [churchApp, dashboard, admin, preparations, migration] = await Promise.all([
    readFile(new URL("../app/church-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/member-preparations.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260822193000_fellowship_preparation_moderation.sql", import.meta.url), "utf8"),
  ]);

  assert.match(churchApp, /hash\.startsWith\("#preparations"\)/);
  assert.match(dashboard, /props\.screen === "preparations"/);
  assert.match(preparations, /from\("fellowship_preparations"\)\.insert/);
  assert.match(preparations, /list_preparation_feed/);
  assert.match(admin, /list_preparation_queue/);
  assert.match(admin, /reviewPreparation\(preparation\.id, "approved"\)/);
  assert.match(admin, /selectedChurch\.my_role === "super_admin"/);
  assert.match(migration, /create policy fellowship_preparations_select/);
  assert.match(migration, /status = 'approved'/);
  assert.match(migration, /drop policy memberships_select/);
  assert.match(migration, /security invoker/);
});

test("connects admin role assignment to the member responsibility screen", async () => {
  const [dashboard, admin, manager, liveAssignments, migration] = await Promise.all([
    readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin-assignment-manager.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/live-assignments.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260823074909_fellowship_assignment_workflow.sql", import.meta.url), "utf8"),
  ]);

  assert.match(dashboard, /userId={props\.authenticatedUserId}/);
  assert.match(admin, /<AdminAssignmentManager/);
  assert.match(manager, /list_fellowship_assignments/);
  assert.match(manager, /from\("assignments"\)\.insert/);
  assert.match(liveAssignments, /list_my_assignments/);
  assert.match(liveAssignments, /status: "accepted"/);
  assert.match(migration, /create policy assignments_select/);
  assert.match(migration, /private\.can_manage_fellowship\(fellowship_id, 'program'\)/);
  assert.match(migration, /create table public\.assignment_audit/);
  assert.match(migration, /security invoker/);
});

test("publishes tenant-safe fellowship recaps from admin to church members", async () => {
  const [dashboard, admin, publisher, liveRecaps, migration] = await Promise.all([
    readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin-recap-publisher.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/live-fellowship-recaps.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260823081324_authenticated_recap_publication.sql", import.meta.url), "utf8"),
  ]);

  assert.match(dashboard, /<FellowshipRecap[^>]+memberships={props\.memberships}/);
  assert.match(admin, /<AdminRecapPublisher/);
  assert.match(publisher, /list_manageable_recaps/);
  assert.match(publisher, /status: "published"/);
  assert.match(liveRecaps, /list_published_recaps/);
  assert.match(liveRecaps, /#recaps\/\$\{recapId\}/);
  assert.match(migration, /create table public\.recap_publication_audit/);
  assert.match(migration, /A new recap must begin as a draft/);
  assert.match(migration, /Published recap content is immutable/);
  assert.match(migration, /private\.can_manage_fellowship\(recap\.fellowship_id, 'program'\)/);
  assert.match(migration, /security invoker/);
});

test("connects admin attendance marking to member self-history", async () => {
  const [churchApp, dashboard, admin, manager, memberHistory, migration] = await Promise.all([
    readFile(new URL("../app/church-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin-attendance-manager.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/member-attendance.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260823083418_fellowship_attendance_workflow.sql", import.meta.url), "utf8"),
  ]);

  assert.match(churchApp, /hash\.startsWith\("#attendance"\)/);
  assert.match(dashboard, /props\.screen === "attendance"/);
  assert.match(admin, /<AdminAttendanceManager/);
  assert.match(manager, /list_fellowship_attendance/);
  assert.match(manager, /from\("attendance"\)\.insert/);
  assert.match(memberHistory, /list_my_attendance/);
  assert.match(migration, /create table public\.attendance_audit/);
  assert.match(migration, /requested_action in \('schedule', 'program', 'attendance'\)/);
  assert.match(migration, /Recorded attendance must be attended, missed, or excused/);
  assert.match(migration, /security invoker/);
});

test("keeps platform, church-admin, and member account provisioning separate", async () => {
  const [membership, admin, provisioner, migration, guide] = await Promise.all([
    readFile(new URL("../app/church-membership.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/super-admin-church-provisioner.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260824040029_separate_platform_and_church_roles.sql", import.meta.url), "utf8"),
    readFile(new URL("../ROLE_ACCOUNT_SETUP.md", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(membership, /from\("churches"\)\.insert/);
  assert.match(membership, /अनुरोधले कुनै प्रशासन भूमिका दिँदैन/);
  assert.match(admin, /<SuperAdminChurchProvisioner/);
  assert.match(provisioner, /rpc\("provision_church"/);
  assert.match(provisioner, /सुपर एडमिन आफैँ मण्डली प्रशासक बन्न सक्दैन/);
  assert.match(migration, /drop trigger if exists on_church_created/);
  assert.match(migration, /revoke insert on public\.churches from authenticated/);
  assert.match(migration, /A platform super administrator cannot also be a church owner or administrator/);
  assert.match(migration, /The platform super administrator and church administrator must be different accounts/);
  assert.match(guide, /Creating a Supabase Auth user.*creates only a normal authenticated account/);
  assert.match(guide, /three Chrome profiles/);
});

test("collects private signup details and approves self-selected church memberships", async () => {
  const [churchApp, membership, admin, directory, dashboard, migration] = await Promise.all([
    readFile(new URL("../app/church-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/church-membership.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/member-directory.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260824122500_member_church_application_onboarding.sql", import.meta.url), "utf8"),
  ]);

  assert.match(churchApp, /date_of_birth: dateOfBirth/);
  assert.match(churchApp, /permanent_address: permanentAddress\.trim\(\)/);
  assert.match(churchApp, /temporary_address: sameAsPermanent/);
  assert.match(churchApp, /gender,/);
  assert.match(churchApp, /rpc\("list_joinable_churches"\)/);
  assert.match(membership, /from\("membership_join_requests"\)\.insert\(\{ user_id: userId, church_id: selectedChurchId \}\)/);
  assert.match(admin, /rpc\("list_pending_membership_requests"/);
  assert.match(admin, /rpc\("review_membership_request"/);
  assert.match(directory, /rpc\("list_church_members"/);
  assert.match(dashboard, /<MemberDirectory userId=\{props\.authenticatedUserId\} memberships=\{props\.memberships\}/);
  assert.match(migration, /request_status in \('pending', 'approved', 'rejected'\)/);
  assert.match(migration, /Only an active church owner or administrator can review membership requests/);
  assert.match(migration, /profile_private\.permanent_address is[\s\S]+never exposed by the church directory API/);
});

test("shows preparation posting only for leaders, post-holders, and assigned members", async () => {
  const [churchApp, moreSettings, preparations, migration] = await Promise.all([
    readFile(new URL("../app/church-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/more-settings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/member-preparations.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260824040807_responsibility_scoped_preparation_posting.sql", import.meta.url), "utf8"),
  ]);

  assert.match(churchApp, /rpc\("can_post_preparations"\)/);
  assert.match(moreSettings, /profile\.canPostPreparations && <button[^>]+preparation-directory-entry/);
  assert.match(preparations, /list_preparation_posting_fellowships/);
  assert.match(preparations, /पोस्ट गर्ने विकल्प अहिले उपलब्ध छैन/);
  assert.match(migration, /membership\.role in \('owner', 'admin', 'leader'\)/);
  assert.match(migration, /assignment\.status in \('assigned', 'accepted'\)/);
  assert.match(migration, /from public\.fellowship_staff staff/);
  assert.match(migration, /create policy fellowship_preparations_insert/);
  assert.match(migration, /Preparation posting requires a church leadership role, fellowship post, or active responsibility/);
});

test("delivers role-aware church-scoped workflow notifications", async () => {
  const [churchApp, dashboard, notifications, migration] = await Promise.all([
    readFile(new URL("../app/church-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/live-notifications.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260824043834_role_aware_in_app_notifications.sql", import.meta.url), "utf8"),
  ]);

  assert.match(churchApp, /hash\.startsWith\("#notifications"\)/);
  assert.match(churchApp, /hash\.startsWith\("#schedule"\)/);
  assert.match(dashboard, /<LiveNotifications[^>]+authenticatedUserId/);
  assert.match(dashboard, /notification_unread_count/);
  assert.match(notifications, /rpc\("list_my_notifications"/);
  assert.match(notifications, /from\("notifications"\)[\s\S]+update\(\{ read_at:/);
  assert.match(notifications, /church_name_ne \|\| notification\.church_name/);
  assert.match(migration, /create table public\.notifications/);
  assert.match(migration, /foreign key \(church_id, recipient_user_id\)[\s\S]+references public\.memberships/);
  assert.match(migration, /recipient_user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /membership\.status = 'active'/);
  assert.match(migration, /create trigger assignments_create_notification/);
  assert.match(migration, /create trigger fellowship_preparations_decision_notification/);
  assert.match(migration, /create trigger recaps_publish_notification/);
  assert.match(migration, /create trigger fellowships_schedule_notification/);
  assert.match(migration, /create trigger attendance_change_notification/);
  assert.match(migration, /revoke all on public\.notifications from public, anon, authenticated/);
});

test("builds fellowship song and Scripture slides with a private member notebook", async () => {
  const [churchApp, dashboard, service, presentationExport, recorder, migration] = await Promise.all([
    readFile(new URL("../app/church-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/fellowship-service.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/fellowship-presentation-export.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/voice-note-recorder.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260824045824_fellowship_service_slides_and_member_notebook.sql", import.meta.url), "utf8"),
  ]);

  assert.match(churchApp, /hash\.startsWith\("#service\/"\)/);
  assert.match(dashboard, /<FellowshipService[^>]+authenticatedUserId/);
  assert.match(service, /rpc\("list_fellowship_service_slides"/);
  assert.match(service, /from\("fellowship_service_items"\)\.insert/);
  assert.match(service, /member_fellowship_notes/);
  assert.match(service, /member_verse_highlights/);
  assert.match(service, /renderChordedLine\(line, transpose\)/);
  assert.match(service, /PowerPoint डाउनलोड/);
  assert.match(service, /generateFellowshipPowerPoint/);
  assert.match(presentationExport, /layout = "LAYOUT_WIDE"/);
  assert.match(presentationExport, /fontSize: 54/);
  assert.match(presentationExport, /fontSize: bodyFontSize/);
  assert.match(presentationExport, /chunkLines\(cleanLyrics/);
  assert.match(presentationExport, /chunkScripture/);
  assert.match(presentationExport, /Unsplash License/);
  assert.match(presentationExport, /slide\.addNotes\(`\[Sources\]/);
  assert.match(recorder, /storage[\s\S]+from\("member-voice-notes"\)[\s\S]+\.upload/);
  assert.match(recorder, /MAX_FILE_BYTES = 10 \* 1024 \* 1024/);
  assert.match(migration, /create table public\.fellowship_service_plans/);
  assert.match(migration, /create table public\.fellowship_service_items/);
  assert.match(migration, /create table public\.member_fellowship_notes/);
  assert.match(migration, /create table public\.member_verse_highlights/);
  assert.match(migration, /create table public\.member_voice_notes/);
  assert.match(migration, /insert into storage\.buckets/);
  assert.match(migration, /recipient_user_id|user_id = \(select auth\.uid\(\)\)/);
});
