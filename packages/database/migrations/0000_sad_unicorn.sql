CREATE TYPE "public"."assignment_status" AS ENUM('assigned', 'accepted', 'declined', 'completed');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('unknown', 'attended', 'missed', 'excused');--> statement-breakpoint
CREATE TYPE "public"."church_status" AS ENUM('active', 'suspended', 'archived');--> statement-breakpoint
CREATE TYPE "public"."fellowship_status" AS ENUM('draft', 'scheduled', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('female', 'male', 'other', 'prefer_not_to_say');--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('ne', 'en');--> statement-breakpoint
CREATE TYPE "public"."membership_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('owner', 'admin', 'leader', 'member');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."platform_role" AS ENUM('super_admin');--> statement-breakpoint
CREATE TYPE "public"."preparation_status" AS ENUM('draft', 'submitted', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."preparation_type" AS ENUM('program_note', 'testimony', 'prayer', 'song', 'scripture');--> statement-breakpoint
CREATE TYPE "public"."recap_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."service_item_kind" AS ENUM('song', 'scripture');--> statement-breakpoint
CREATE TYPE "public"."service_plan_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."service_section" AS ENUM('opening', 'worship', 'sermon', 'response', 'closing');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"fellowship_id" bigint NOT NULL,
	"member_membership_id" bigint NOT NULL,
	"ministry_role_id" bigint NOT NULL,
	"notes" text,
	"status" "assignment_status" DEFAULT 'assigned' NOT NULL,
	"assigned_by" uuid NOT NULL,
	"responded_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"church_id" bigint NOT NULL,
	"fellowship_id" bigint NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "attendance_status" DEFAULT 'unknown' NOT NULL,
	"notes" text,
	"marked_by" uuid,
	"marked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"church_id" bigint,
	"actor_user_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bible_references" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source_code" text DEFAULT 'nepali' NOT NULL,
	"book_code" text NOT NULL,
	"book_name_ne" text NOT NULL,
	"chapter" smallint NOT NULL,
	"verse_start" smallint,
	"verse_end" smallint,
	"label_ne" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "church_invites" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"church_id" bigint NOT NULL,
	"code_hash" text NOT NULL,
	"role" "membership_role" DEFAULT 'member' NOT NULL,
	"max_uses" smallint DEFAULT 1 NOT NULL,
	"use_count" smallint DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "churches" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_ne" text,
	"description" text,
	"address" text,
	"status" "church_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid NOT NULL,
	"status_changed_by" uuid,
	"status_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fellowship_preparations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"church_id" bigint NOT NULL,
	"fellowship_id" bigint NOT NULL,
	"membership_id" bigint NOT NULL,
	"preparation_type" "preparation_type" DEFAULT 'program_note' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"status" "preparation_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"review_note" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fellowship_service_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"plan_id" bigint NOT NULL,
	"church_id" bigint NOT NULL,
	"item_kind" "service_item_kind" NOT NULL,
	"section" "service_section" NOT NULL,
	"position" smallint NOT NULL,
	"song_id" bigint,
	"book_code" text,
	"book_name_ne" text,
	"chapter" smallint,
	"verse_start" smallint,
	"verse_end" smallint,
	"label" text,
	"note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fellowship_service_plans" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"church_id" bigint NOT NULL,
	"fellowship_id" bigint NOT NULL,
	"status" "service_plan_status" DEFAULT 'draft' NOT NULL,
	"sermon_topic" text,
	"sermon_summary" text,
	"preacher_membership_id" bigint,
	"created_by" uuid NOT NULL,
	"published_by" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fellowship_staff" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"church_id" bigint NOT NULL,
	"fellowship_id" bigint NOT NULL,
	"membership_id" bigint NOT NULL,
	"duty" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fellowships" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"church_id" bigint NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"location_name" text,
	"address" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"status" "fellowship_status" DEFAULT 'draft' NOT NULL,
	"host_membership_id" bigint,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_fellowship_notes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"church_id" bigint NOT NULL,
	"fellowship_id" bigint NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_verse_highlights" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"church_id" bigint NOT NULL,
	"fellowship_id" bigint NOT NULL,
	"user_id" uuid NOT NULL,
	"book_code" text NOT NULL,
	"book_name_ne" text NOT NULL,
	"chapter" smallint NOT NULL,
	"verse_start" smallint NOT NULL,
	"verse_end" smallint NOT NULL,
	"selected_text" text NOT NULL,
	"reflection" text,
	"color" text DEFAULT 'gold' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_voice_notes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"church_id" bigint NOT NULL,
	"fellowship_id" bigint NOT NULL,
	"user_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"caption" text,
	"duration_seconds" integer NOT NULL,
	"size_bytes" integer NOT NULL,
	"mime_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership_join_requests" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"church_id" bigint,
	"invite_id" bigint,
	"membership_id" bigint,
	"submitted_code_hash" text,
	"request_status" "membership_request_status" DEFAULT 'pending' NOT NULL,
	"requested_role" "membership_role" DEFAULT 'member' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"church_id" bigint NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "membership_role" DEFAULT 'member' NOT NULL,
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ministry_roles" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ne" text NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "ministry_roles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"church_id" bigint NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"route" text NOT NULL,
	"source_table" text NOT NULL,
	"source_id" bigint NOT NULL,
	"actor_user_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_roles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"role" "platform_role" NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_private" (
	"id" uuid PRIMARY KEY NOT NULL,
	"phone" text,
	"date_of_birth" date,
	"gender" "gender",
	"permanent_address" text,
	"temporary_address" text,
	"high_contrast" boolean DEFAULT false NOT NULL,
	"text_scale_override" numeric(3, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"avatar_url" text,
	"preferred_language" "language" DEFAULT 'ne' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recap_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"recap_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"song_id" bigint,
	"bible_reference_id" bigint,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recaps" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"church_id" bigint NOT NULL,
	"fellowship_id" bigint NOT NULL,
	"author_id" uuid NOT NULL,
	"title" text NOT NULL,
	"message_notes" text NOT NULL,
	"testimony" text,
	"prayer_points" text[] DEFAULT '{}'::text[] NOT NULL,
	"scripture_references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"song_external_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "recap_status" DEFAULT 'draft' NOT NULL,
	"published_by" uuid,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "song_favorites" (
	"user_id" uuid NOT NULL,
	"song_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "song_favorites_user_id_song_id_pk" PRIMARY KEY("user_id","song_id")
);
--> statement-breakpoint
CREATE TABLE "songs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"church_id" bigint,
	"external_source" text,
	"external_id" text,
	"song_number" integer,
	"song_type" text,
	"song_language" text,
	"title_ne" text NOT NULL,
	"title_romanized" text,
	"description" text,
	"category" text DEFAULT 'आराधना' NOT NULL,
	"lyrics_ne" text NOT NULL,
	"lyrics_romanized" text,
	"lyrics_transliterated" text,
	"chords" text,
	"beat" text,
	"audio_url" text,
	"video_url" text,
	"artist_id" bigint,
	"artist_credit" text,
	"source_name" text,
	"source_url" text,
	"license_note" text,
	"source_payload" jsonb,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"original_created_at" timestamp with time zone,
	"original_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"token_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worship_artists" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"external_source" text NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"photo_url" text,
	"source_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"original_created_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_fellowship_id_fellowships_id_fk" FOREIGN KEY ("fellowship_id") REFERENCES "public"."fellowships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_member_membership_id_memberships_id_fk" FOREIGN KEY ("member_membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_ministry_role_id_ministry_roles_id_fk" FOREIGN KEY ("ministry_role_id") REFERENCES "public"."ministry_roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_fellowship_id_fellowships_id_fk" FOREIGN KEY ("fellowship_id") REFERENCES "public"."fellowships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_marked_by_users_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bible_references" ADD CONSTRAINT "bible_references_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "church_invites" ADD CONSTRAINT "church_invites_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "church_invites" ADD CONSTRAINT "church_invites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "churches" ADD CONSTRAINT "churches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "churches" ADD CONSTRAINT "churches_status_changed_by_users_id_fk" FOREIGN KEY ("status_changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fellowship_preparations" ADD CONSTRAINT "fellowship_preparations_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fellowship_preparations" ADD CONSTRAINT "fellowship_preparations_fellowship_id_fellowships_id_fk" FOREIGN KEY ("fellowship_id") REFERENCES "public"."fellowships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fellowship_preparations" ADD CONSTRAINT "fellowship_preparations_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fellowship_preparations" ADD CONSTRAINT "fellowship_preparations_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fellowship_service_items" ADD CONSTRAINT "fellowship_service_items_plan_id_fellowship_service_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."fellowship_service_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fellowship_service_items" ADD CONSTRAINT "fellowship_service_items_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fellowship_service_items" ADD CONSTRAINT "fellowship_service_items_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fellowship_service_items" ADD CONSTRAINT "fellowship_service_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fellowship_service_plans" ADD CONSTRAINT "fellowship_service_plans_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fellowship_service_plans" ADD CONSTRAINT "fellowship_service_plans_fellowship_id_fellowships_id_fk" FOREIGN KEY ("fellowship_id") REFERENCES "public"."fellowships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fellowship_service_plans" ADD CONSTRAINT "fellowship_service_plans_preacher_membership_id_memberships_id_fk" FOREIGN KEY ("preacher_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fellowship_service_plans" ADD CONSTRAINT "fellowship_service_plans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fellowship_service_plans" ADD CONSTRAINT "fellowship_service_plans_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fellowship_staff" ADD CONSTRAINT "fellowship_staff_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fellowship_staff" ADD CONSTRAINT "fellowship_staff_fellowship_id_fellowships_id_fk" FOREIGN KEY ("fellowship_id") REFERENCES "public"."fellowships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fellowship_staff" ADD CONSTRAINT "fellowship_staff_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fellowship_staff" ADD CONSTRAINT "fellowship_staff_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fellowships" ADD CONSTRAINT "fellowships_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fellowships" ADD CONSTRAINT "fellowships_host_membership_id_memberships_id_fk" FOREIGN KEY ("host_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fellowships" ADD CONSTRAINT "fellowships_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_fellowship_notes" ADD CONSTRAINT "member_fellowship_notes_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_fellowship_notes" ADD CONSTRAINT "member_fellowship_notes_fellowship_id_fellowships_id_fk" FOREIGN KEY ("fellowship_id") REFERENCES "public"."fellowships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_fellowship_notes" ADD CONSTRAINT "member_fellowship_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_verse_highlights" ADD CONSTRAINT "member_verse_highlights_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_verse_highlights" ADD CONSTRAINT "member_verse_highlights_fellowship_id_fellowships_id_fk" FOREIGN KEY ("fellowship_id") REFERENCES "public"."fellowships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_verse_highlights" ADD CONSTRAINT "member_verse_highlights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_voice_notes" ADD CONSTRAINT "member_voice_notes_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_voice_notes" ADD CONSTRAINT "member_voice_notes_fellowship_id_fellowships_id_fk" FOREIGN KEY ("fellowship_id") REFERENCES "public"."fellowships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_voice_notes" ADD CONSTRAINT "member_voice_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_join_requests" ADD CONSTRAINT "membership_join_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_join_requests" ADD CONSTRAINT "membership_join_requests_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_join_requests" ADD CONSTRAINT "membership_join_requests_invite_id_church_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."church_invites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_join_requests" ADD CONSTRAINT "membership_join_requests_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_join_requests" ADD CONSTRAINT "membership_join_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_roles" ADD CONSTRAINT "platform_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_roles" ADD CONSTRAINT "platform_roles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_private" ADD CONSTRAINT "profile_private_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recap_items" ADD CONSTRAINT "recap_items_recap_id_recaps_id_fk" FOREIGN KEY ("recap_id") REFERENCES "public"."recaps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recap_items" ADD CONSTRAINT "recap_items_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recap_items" ADD CONSTRAINT "recap_items_bible_reference_id_bible_references_id_fk" FOREIGN KEY ("bible_reference_id") REFERENCES "public"."bible_references"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recaps" ADD CONSTRAINT "recaps_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recaps" ADD CONSTRAINT "recaps_fellowship_id_fellowships_id_fk" FOREIGN KEY ("fellowship_id") REFERENCES "public"."fellowships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recaps" ADD CONSTRAINT "recaps_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recaps" ADD CONSTRAINT "recaps_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_favorites" ADD CONSTRAINT "song_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_favorites" ADD CONSTRAINT "song_favorites_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "songs" ADD CONSTRAINT "songs_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "songs" ADD CONSTRAINT "songs_artist_id_worship_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."worship_artists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "songs" ADD CONSTRAINT "songs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assignments_fellowship_member_role_uidx" ON "assignments" USING btree ("fellowship_id","member_membership_id","ministry_role_id");--> statement-breakpoint
CREATE INDEX "assignments_member_status_idx" ON "assignments" USING btree ("member_membership_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_fellowship_user_uidx" ON "attendance" USING btree ("fellowship_id","user_id");--> statement-breakpoint
CREATE INDEX "attendance_user_church_idx" ON "attendance" USING btree ("user_id","church_id");--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "bible_references_book_chapter_idx" ON "bible_references" USING btree ("book_code","chapter");--> statement-breakpoint
CREATE UNIQUE INDEX "church_invites_code_hash_uidx" ON "church_invites" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "church_invites_church_expires_idx" ON "church_invites" USING btree ("church_id","expires_at");--> statement-breakpoint
CREATE INDEX "churches_status_idx" ON "churches" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "churches_name_lower_uidx" ON "churches" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "preparations_church_status_idx" ON "fellowship_preparations" USING btree ("church_id","status","created_at");--> statement-breakpoint
CREATE INDEX "preparations_member_idx" ON "fellowship_preparations" USING btree ("membership_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "service_items_plan_position_uidx" ON "fellowship_service_items" USING btree ("plan_id","position");--> statement-breakpoint
CREATE INDEX "service_items_church_idx" ON "fellowship_service_items" USING btree ("church_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_plans_fellowship_uidx" ON "fellowship_service_plans" USING btree ("fellowship_id");--> statement-breakpoint
CREATE INDEX "service_plans_church_status_idx" ON "fellowship_service_plans" USING btree ("church_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "fellowship_staff_duty_uidx" ON "fellowship_staff" USING btree ("fellowship_id","membership_id","duty");--> statement-breakpoint
CREATE INDEX "fellowship_staff_membership_idx" ON "fellowship_staff" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "fellowships_church_start_idx" ON "fellowships" USING btree ("church_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "member_notes_fellowship_user_uidx" ON "member_fellowship_notes" USING btree ("fellowship_id","user_id");--> statement-breakpoint
CREATE INDEX "member_notes_church_user_idx" ON "member_fellowship_notes" USING btree ("church_id","user_id");--> statement-breakpoint
CREATE INDEX "member_highlights_fellowship_user_idx" ON "member_verse_highlights" USING btree ("fellowship_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_voice_notes_path_uidx" ON "member_voice_notes" USING btree ("storage_path");--> statement-breakpoint
CREATE INDEX "member_voice_notes_fellowship_user_idx" ON "member_voice_notes" USING btree ("fellowship_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_join_requests_pending_uidx" ON "membership_join_requests" USING btree ("church_id","user_id") WHERE "membership_join_requests"."request_status" = 'pending';--> statement-breakpoint
CREATE INDEX "membership_join_requests_church_status_idx" ON "membership_join_requests" USING btree ("church_id","request_status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_church_user_uidx" ON "memberships" USING btree ("church_id","user_id");--> statement-breakpoint
CREATE INDEX "memberships_user_status_idx" ON "memberships" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "memberships_church_role_status_idx" ON "memberships" USING btree ("church_id","role","status");--> statement-breakpoint
CREATE INDEX "notifications_recipient_created_idx" ON "notifications" USING btree ("recipient_user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_church_recipient_idx" ON "notifications" USING btree ("church_id","recipient_user_id");--> statement-breakpoint
CREATE INDEX "recap_items_recap_position_idx" ON "recap_items" USING btree ("recap_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "recaps_fellowship_uidx" ON "recaps" USING btree ("fellowship_id");--> statement-breakpoint
CREATE INDEX "recaps_church_status_idx" ON "recaps" USING btree ("church_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_sessions_token_hash_uidx" ON "refresh_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_sessions_user_expires_idx" ON "refresh_sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "songs_external_source_uidx" ON "songs" USING btree ("external_source","external_id") WHERE "songs"."external_source" is not null and "songs"."external_id" is not null;--> statement-breakpoint
CREATE INDEX "songs_type_number_idx" ON "songs" USING btree ("song_type","song_number");--> statement-breakpoint
CREATE INDEX "songs_church_published_idx" ON "songs" USING btree ("church_id","is_published");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_uidx" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "worship_artists_source_uidx" ON "worship_artists" USING btree ("external_source","external_id");