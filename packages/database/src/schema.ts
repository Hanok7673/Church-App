import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userStatus = pgEnum("user_status", ["active", "disabled"]);
export const gender = pgEnum("gender", ["female", "male", "other", "prefer_not_to_say"]);
export const language = pgEnum("language", ["ne", "en"]);
export const platformRole = pgEnum("platform_role", ["super_admin"]);
export const churchStatus = pgEnum("church_status", ["active", "suspended", "archived"]);
export const membershipRole = pgEnum("membership_role", ["owner", "admin", "leader", "member"]);
export const membershipStatus = pgEnum("membership_status", ["active", "inactive"]);
export const membershipRequestStatus = pgEnum("membership_request_status", ["pending", "approved", "rejected"]);
export const fellowshipStatus = pgEnum("fellowship_status", ["draft", "scheduled", "completed", "cancelled"]);
export const assignmentStatus = pgEnum("assignment_status", ["assigned", "accepted", "declined", "completed"]);
export const attendanceStatus = pgEnum("attendance_status", ["unknown", "attended", "missed", "excused"]);
export const preparationType = pgEnum("preparation_type", ["program_note", "testimony", "prayer", "song", "scripture"]);
export const preparationStatus = pgEnum("preparation_status", ["draft", "submitted", "approved", "rejected"]);
export const recapStatus = pgEnum("recap_status", ["draft", "published", "archived"]);
export const servicePlanStatus = pgEnum("service_plan_status", ["draft", "published"]);
export const serviceItemKind = pgEnum("service_item_kind", ["song", "scripture"]);
export const serviceSection = pgEnum("service_section", ["opening", "worship", "sermon", "response", "closing"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  status: userStatus("status").default("active").notNull(),
  tokenVersion: integer("token_version").default(0).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [uniqueIndex("users_email_lower_uidx").on(sql`lower(${table.email})`)]);

export const refreshSessions = pgTable("refresh_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("refresh_sessions_token_hash_uidx").on(table.tokenHash),
  index("refresh_sessions_user_expires_idx").on(table.userId, table.expiresAt),
]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  avatarUrl: text("avatar_url"),
  preferredLanguage: language("preferred_language").default("ne").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const profilePrivate = pgTable("profile_private", {
  id: uuid("id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  phone: text("phone"),
  dateOfBirth: date("date_of_birth"),
  gender: gender("gender"),
  permanentAddress: text("permanent_address"),
  temporaryAddress: text("temporary_address"),
  highContrast: boolean("high_contrast").default(false).notNull(),
  textScaleOverride: numeric("text_scale_override", { precision: 3, scale: 2 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const platformRoles = pgTable("platform_roles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  role: platformRole("role").notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const churches = pgTable("churches", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  nameNe: text("name_ne"),
  description: text("description"),
  address: text("address"),
  status: churchStatus("status").default("active").notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  statusChangedBy: uuid("status_changed_by").references(() => users.id, { onDelete: "set null" }),
  statusChangedAt: timestamp("status_changed_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("churches_status_idx").on(table.status),
  uniqueIndex("churches_name_lower_uidx").on(sql`lower(${table.name})`),
]);

export const memberships = pgTable("memberships", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  churchId: bigint("church_id", { mode: "number" }).notNull().references(() => churches.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: membershipRole("role").default("member").notNull(),
  status: membershipStatus("status").default("active").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("memberships_church_user_uidx").on(table.churchId, table.userId),
  index("memberships_user_status_idx").on(table.userId, table.status),
  index("memberships_church_role_status_idx").on(table.churchId, table.role, table.status),
]);

export const churchInvites = pgTable("church_invites", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  churchId: bigint("church_id", { mode: "number" }).notNull().references(() => churches.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(),
  role: membershipRole("role").default("member").notNull(),
  maxUses: smallint("max_uses").default(1).notNull(),
  useCount: smallint("use_count").default(0).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("church_invites_code_hash_uidx").on(table.codeHash),
  index("church_invites_church_expires_idx").on(table.churchId, table.expiresAt),
]);

export const membershipJoinRequests = pgTable("membership_join_requests", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  churchId: bigint("church_id", { mode: "number" }).references(() => churches.id, { onDelete: "cascade" }),
  inviteId: bigint("invite_id", { mode: "number" }).references(() => churchInvites.id, { onDelete: "set null" }),
  membershipId: bigint("membership_id", { mode: "number" }).references(() => memberships.id, { onDelete: "set null" }),
  submittedCodeHash: text("submitted_code_hash"),
  status: membershipRequestStatus("request_status").default("pending").notNull(),
  requestedRole: membershipRole("requested_role").default("member").notNull(),
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewNote: text("review_note"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("membership_join_requests_pending_uidx").on(table.churchId, table.userId).where(sql`${table.status} = 'pending'`),
  index("membership_join_requests_church_status_idx").on(table.churchId, table.status, table.createdAt),
]);

export const ministryRoles = pgTable("ministry_roles", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  code: text("code").notNull().unique(),
  nameEn: text("name_en").notNull(),
  nameNe: text("name_ne").notNull(),
  sortOrder: smallint("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

export const fellowships = pgTable("fellowships", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  churchId: bigint("church_id", { mode: "number" }).notNull().references(() => churches.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  locationName: text("location_name"),
  address: text("address"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  status: fellowshipStatus("status").default("draft").notNull(),
  hostMembershipId: bigint("host_membership_id", { mode: "number" }).references(() => memberships.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [index("fellowships_church_start_idx").on(table.churchId, table.startsAt)]);

export const fellowshipStaff = pgTable("fellowship_staff", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  churchId: bigint("church_id", { mode: "number" }).notNull().references(() => churches.id, { onDelete: "cascade" }),
  fellowshipId: bigint("fellowship_id", { mode: "number" }).notNull().references(() => fellowships.id, { onDelete: "cascade" }),
  membershipId: bigint("membership_id", { mode: "number" }).notNull().references(() => memberships.id, { onDelete: "cascade" }),
  duty: text("duty").notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("fellowship_staff_duty_uidx").on(table.fellowshipId, table.membershipId, table.duty),
  index("fellowship_staff_membership_idx").on(table.membershipId),
]);

export const assignments = pgTable("assignments", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  fellowshipId: bigint("fellowship_id", { mode: "number" }).notNull().references(() => fellowships.id, { onDelete: "cascade" }),
  memberMembershipId: bigint("member_membership_id", { mode: "number" }).notNull().references(() => memberships.id, { onDelete: "cascade" }),
  ministryRoleId: bigint("ministry_role_id", { mode: "number" }).notNull().references(() => ministryRoles.id, { onDelete: "restrict" }),
  notes: text("notes"),
  status: assignmentStatus("status").default("assigned").notNull(),
  assignedBy: uuid("assigned_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("assignments_fellowship_member_role_uidx").on(table.fellowshipId, table.memberMembershipId, table.ministryRoleId),
  index("assignments_member_status_idx").on(table.memberMembershipId, table.status),
]);

export const fellowshipPreparations = pgTable("fellowship_preparations", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  churchId: bigint("church_id", { mode: "number" }).notNull().references(() => churches.id, { onDelete: "cascade" }),
  fellowshipId: bigint("fellowship_id", { mode: "number" }).notNull().references(() => fellowships.id, { onDelete: "cascade" }),
  membershipId: bigint("membership_id", { mode: "number" }).notNull().references(() => memberships.id, { onDelete: "cascade" }),
  type: preparationType("preparation_type").default("program_note").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  status: preparationStatus("status").default("draft").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewNote: text("review_note"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("preparations_church_status_idx").on(table.churchId, table.status, table.createdAt),
  index("preparations_member_idx").on(table.membershipId, table.createdAt),
]);

export const attendance = pgTable("attendance", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  churchId: bigint("church_id", { mode: "number" }).notNull().references(() => churches.id, { onDelete: "cascade" }),
  fellowshipId: bigint("fellowship_id", { mode: "number" }).notNull().references(() => fellowships.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: attendanceStatus("status").default("unknown").notNull(),
  notes: text("notes"),
  markedBy: uuid("marked_by").references(() => users.id, { onDelete: "set null" }),
  markedAt: timestamp("marked_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("attendance_fellowship_user_uidx").on(table.fellowshipId, table.userId),
  index("attendance_user_church_idx").on(table.userId, table.churchId),
]);

export const worshipArtists = pgTable("worship_artists", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  externalSource: text("external_source").notNull(),
  externalId: text("external_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  photoUrl: text("photo_url"),
  sourcePayload: jsonb("source_payload").$type<Record<string, unknown>>().default({}).notNull(),
  originalCreatedAt: timestamp("original_created_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [uniqueIndex("worship_artists_source_uidx").on(table.externalSource, table.externalId)]);

export const songs = pgTable("songs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  churchId: bigint("church_id", { mode: "number" }).references(() => churches.id, { onDelete: "cascade" }),
  externalSource: text("external_source"),
  externalId: text("external_id"),
  songNumber: integer("song_number"),
  songType: text("song_type"),
  songLanguage: text("song_language"),
  titleNe: text("title_ne").notNull(),
  titleRomanized: text("title_romanized"),
  description: text("description"),
  category: text("category").default("आराधना").notNull(),
  lyricsNe: text("lyrics_ne").notNull(),
  lyricsRomanized: text("lyrics_romanized"),
  lyricsTransliterated: text("lyrics_transliterated"),
  chords: text("chords"),
  beat: text("beat"),
  audioUrl: text("audio_url"),
  videoUrl: text("video_url"),
  artistId: bigint("artist_id", { mode: "number" }).references(() => worshipArtists.id, { onDelete: "set null" }),
  artistCredit: text("artist_credit"),
  sourceName: text("source_name"),
  sourceUrl: text("source_url"),
  licenseNote: text("license_note"),
  sourcePayload: jsonb("source_payload").$type<Record<string, unknown>>(),
  isPublished: boolean("is_published").default(false).notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  originalCreatedAt: timestamp("original_created_at", { withTimezone: true }),
  originalUpdatedAt: timestamp("original_updated_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("songs_external_source_uidx").on(table.externalSource, table.externalId).where(sql`${table.externalSource} is not null and ${table.externalId} is not null`),
  index("songs_type_number_idx").on(table.songType, table.songNumber),
  index("songs_church_published_idx").on(table.churchId, table.isPublished),
]);

export const songFavorites = pgTable("song_favorites", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  songId: bigint("song_id", { mode: "number" }).notNull().references(() => songs.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
}, (table) => [primaryKey({ columns: [table.userId, table.songId] })]);

export const bibleReferences = pgTable("bible_references", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  sourceCode: text("source_code").default("nepali").notNull(),
  bookCode: text("book_code").notNull(),
  bookNameNe: text("book_name_ne").notNull(),
  chapter: smallint("chapter").notNull(),
  verseStart: smallint("verse_start"),
  verseEnd: smallint("verse_end"),
  labelNe: text("label_ne"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
}, (table) => [index("bible_references_book_chapter_idx").on(table.bookCode, table.chapter)]);

export const recaps = pgTable("recaps", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  churchId: bigint("church_id", { mode: "number" }).notNull().references(() => churches.id, { onDelete: "cascade" }),
  fellowshipId: bigint("fellowship_id", { mode: "number" }).notNull().references(() => fellowships.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  messageNotes: text("message_notes").notNull(),
  testimony: text("testimony"),
  prayerPoints: text("prayer_points").array().default(sql`'{}'::text[]`).notNull(),
  scriptureReferences: jsonb("scripture_references").$type<Array<Record<string, unknown>>>().default([]).notNull(),
  songExternalIds: text("song_external_ids").array().default(sql`'{}'::text[]`).notNull(),
  status: recapStatus("status").default("draft").notNull(),
  publishedBy: uuid("published_by").references(() => users.id, { onDelete: "set null" }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("recaps_fellowship_uidx").on(table.fellowshipId),
  index("recaps_church_status_idx").on(table.churchId, table.status),
]);

export const recapItems = pgTable("recap_items", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  recapId: bigint("recap_id", { mode: "number" }).notNull().references(() => recaps.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  position: smallint("position").default(0).notNull(),
  songId: bigint("song_id", { mode: "number" }).references(() => songs.id, { onDelete: "restrict" }),
  bibleReferenceId: bigint("bible_reference_id", { mode: "number" }).references(() => bibleReferences.id, { onDelete: "restrict" }),
  notes: text("notes"),
  createdAt: createdAt(),
}, (table) => [index("recap_items_recap_position_idx").on(table.recapId, table.position)]);

export const fellowshipServicePlans = pgTable("fellowship_service_plans", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  churchId: bigint("church_id", { mode: "number" }).notNull().references(() => churches.id, { onDelete: "cascade" }),
  fellowshipId: bigint("fellowship_id", { mode: "number" }).notNull().references(() => fellowships.id, { onDelete: "cascade" }),
  status: servicePlanStatus("status").default("draft").notNull(),
  sermonTopic: text("sermon_topic"),
  sermonSummary: text("sermon_summary"),
  preacherMembershipId: bigint("preacher_membership_id", { mode: "number" }).references(() => memberships.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  publishedBy: uuid("published_by").references(() => users.id, { onDelete: "set null" }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("service_plans_fellowship_uidx").on(table.fellowshipId),
  index("service_plans_church_status_idx").on(table.churchId, table.status),
]);

export const fellowshipServiceItems = pgTable("fellowship_service_items", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  planId: bigint("plan_id", { mode: "number" }).notNull().references(() => fellowshipServicePlans.id, { onDelete: "cascade" }),
  churchId: bigint("church_id", { mode: "number" }).notNull().references(() => churches.id, { onDelete: "cascade" }),
  kind: serviceItemKind("item_kind").notNull(),
  section: serviceSection("section").notNull(),
  position: smallint("position").notNull(),
  songId: bigint("song_id", { mode: "number" }).references(() => songs.id, { onDelete: "restrict" }),
  bookCode: text("book_code"),
  bookNameNe: text("book_name_ne"),
  chapter: smallint("chapter"),
  verseStart: smallint("verse_start"),
  verseEnd: smallint("verse_end"),
  label: text("label"),
  note: text("note"),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("service_items_plan_position_uidx").on(table.planId, table.position),
  index("service_items_church_idx").on(table.churchId),
]);

export const memberFellowshipNotes = pgTable("member_fellowship_notes", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  churchId: bigint("church_id", { mode: "number" }).notNull().references(() => churches.id, { onDelete: "cascade" }),
  fellowshipId: bigint("fellowship_id", { mode: "number" }).notNull().references(() => fellowships.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body").default("").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("member_notes_fellowship_user_uidx").on(table.fellowshipId, table.userId),
  index("member_notes_church_user_idx").on(table.churchId, table.userId),
]);

export const memberVerseHighlights = pgTable("member_verse_highlights", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  churchId: bigint("church_id", { mode: "number" }).notNull().references(() => churches.id, { onDelete: "cascade" }),
  fellowshipId: bigint("fellowship_id", { mode: "number" }).notNull().references(() => fellowships.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  bookCode: text("book_code").notNull(),
  bookNameNe: text("book_name_ne").notNull(),
  chapter: smallint("chapter").notNull(),
  verseStart: smallint("verse_start").notNull(),
  verseEnd: smallint("verse_end").notNull(),
  selectedText: text("selected_text").notNull(),
  reflection: text("reflection"),
  color: text("color").default("gold").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [index("member_highlights_fellowship_user_idx").on(table.fellowshipId, table.userId)]);

export const memberVoiceNotes = pgTable("member_voice_notes", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  churchId: bigint("church_id", { mode: "number" }).notNull().references(() => churches.id, { onDelete: "cascade" }),
  fellowshipId: bigint("fellowship_id", { mode: "number" }).notNull().references(() => fellowships.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  storagePath: text("storage_path").notNull(),
  caption: text("caption"),
  durationSeconds: integer("duration_seconds").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  mimeType: text("mime_type").notNull(),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("member_voice_notes_path_uidx").on(table.storagePath),
  index("member_voice_notes_fellowship_user_idx").on(table.fellowshipId, table.userId),
]);

export const notifications = pgTable("notifications", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  churchId: bigint("church_id", { mode: "number" }).notNull().references(() => churches.id, { onDelete: "cascade" }),
  recipientUserId: uuid("recipient_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  route: text("route").notNull(),
  sourceTable: text("source_table").notNull(),
  sourceId: bigint("source_id", { mode: "number" }).notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (table) => [
  index("notifications_recipient_created_idx").on(table.recipientUserId, table.createdAt),
  index("notifications_church_recipient_idx").on(table.churchId, table.recipientUserId),
]);

export const auditEvents = pgTable("audit_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  churchId: bigint("church_id", { mode: "number" }).references(() => churches.id, { onDelete: "cascade" }),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  before: jsonb("before").$type<Record<string, unknown> | null>(),
  after: jsonb("after").$type<Record<string, unknown> | null>(),
  createdAt: createdAt(),
}, (table) => [index("audit_events_entity_idx").on(table.entityType, table.entityId, table.createdAt)]);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type PrivateProfile = typeof profilePrivate.$inferSelect;
export type Church = typeof churches.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type MembershipJoinRequest = typeof membershipJoinRequests.$inferSelect;
export type Fellowship = typeof fellowships.$inferSelect;
export type Assignment = typeof assignments.$inferSelect;
export type Song = typeof songs.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
