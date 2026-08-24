export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      apps: {
        Row: {
          android_version: string | null
          app_id: string
          description: string | null
          developer: string | null
          installs: string | null
          last_fetched: string
          raw_data: Json
          reviews: number | null
          score: number | null
          screenshots: Json
          size: string | null
          source_url: string
          title: string
          updated_date: string | null
          version: string | null
        }
        Insert: {
          android_version?: string | null
          app_id: string
          description?: string | null
          developer?: string | null
          installs?: string | null
          last_fetched?: string
          raw_data?: Json
          reviews?: number | null
          score?: number | null
          screenshots?: Json
          size?: string | null
          source_url: string
          title: string
          updated_date?: string | null
          version?: string | null
        }
        Update: {
          android_version?: string | null
          app_id?: string
          description?: string | null
          developer?: string | null
          installs?: string | null
          last_fetched?: string
          raw_data?: Json
          reviews?: number | null
          score?: number | null
          screenshots?: Json
          size?: string | null
          source_url?: string
          title?: string
          updated_date?: string | null
          version?: string | null
        }
        Relationships: []
      }
      assignment_audit: {
        Row: {
          action: string
          actor_user_id: string | null
          assignment_id: number | null
          church_id: number
          created_at: string
          id: number
          new_status: string | null
          old_status: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          assignment_id?: number | null
          church_id: number
          created_at?: string
          id?: never
          new_status?: string | null
          old_status?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          assignment_id?: number | null
          church_id?: number
          created_at?: string
          id?: never
          new_status?: string | null
          old_status?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_audit_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_audit_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_audit_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_audit_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          assigned_by: string
          completed_at: string | null
          created_at: string
          fellowship_id: number
          id: number
          member_membership_id: number
          ministry_role_id: number
          notes: string | null
          responded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_by: string
          completed_at?: string | null
          created_at?: string
          fellowship_id: number
          id?: never
          member_membership_id: number
          ministry_role_id: number
          notes?: string | null
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string
          completed_at?: string | null
          created_at?: string
          fellowship_id?: number
          id?: never
          member_membership_id?: number
          ministry_role_id?: number
          notes?: string | null
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_fellowship_id_fkey"
            columns: ["fellowship_id"]
            isOneToOne: false
            referencedRelation: "fellowships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_member_membership_id_fkey"
            columns: ["member_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_ministry_role_id_fkey"
            columns: ["ministry_role_id"]
            isOneToOne: false
            referencedRelation: "ministry_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          church_id: number
          created_at: string
          fellowship_id: number
          id: number
          marked_at: string
          marked_by: string | null
          notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          church_id: number
          created_at?: string
          fellowship_id: number
          id?: never
          marked_at?: string
          marked_by?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          church_id?: number
          created_at?: string
          fellowship_id?: number
          id?: never
          marked_at?: string
          marked_by?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_fellowship_id_fkey"
            columns: ["fellowship_id"]
            isOneToOne: false
            referencedRelation: "fellowships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_audit: {
        Row: {
          action: string
          actor_id: string | null
          attendance_id: number | null
          church_id: number
          fellowship_id: number
          id: number
          new_status: string | null
          occurred_at: string
          previous_status: string | null
          user_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          attendance_id?: number | null
          church_id: number
          fellowship_id: number
          id?: never
          new_status?: string | null
          occurred_at?: string
          previous_status?: string | null
          user_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          attendance_id?: number | null
          church_id?: number
          fellowship_id?: number
          id?: never
          new_status?: string | null
          occurred_at?: string
          previous_status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_audit_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_audit_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bible_references: {
        Row: {
          book_code: string
          book_name_ne: string
          chapter: number
          created_at: string
          created_by: string | null
          id: number
          label_ne: string | null
          source_code: string
          verse_end: number | null
          verse_start: number | null
        }
        Insert: {
          book_code: string
          book_name_ne: string
          chapter: number
          created_at?: string
          created_by?: string | null
          id?: never
          label_ne?: string | null
          source_code?: string
          verse_end?: number | null
          verse_start?: number | null
        }
        Update: {
          book_code?: string
          book_name_ne?: string
          chapter?: number
          created_at?: string
          created_by?: string | null
          id?: never
          label_ne?: string | null
          source_code?: string
          verse_end?: number | null
          verse_start?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bible_references_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      church_invites: {
        Row: {
          church_id: number
          code_hash: string
          created_at: string
          created_by: string
          expires_at: string
          id: number
          max_uses: number
          revoked_at: string | null
          role: string
          use_count: number
        }
        Insert: {
          church_id: number
          code_hash: string
          created_at?: string
          created_by: string
          expires_at: string
          id?: never
          max_uses?: number
          revoked_at?: string | null
          role?: string
          use_count?: number
        }
        Update: {
          church_id?: number
          code_hash?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: never
          max_uses?: number
          revoked_at?: string | null
          role?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "church_invites_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "church_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      church_status_audit: {
        Row: {
          actor_user_id: string | null
          church_id: number
          created_at: string
          id: number
          new_status: string
          old_status: string
        }
        Insert: {
          actor_user_id?: string | null
          church_id: number
          created_at?: string
          id?: never
          new_status: string
          old_status: string
        }
        Update: {
          actor_user_id?: string | null
          church_id?: number
          created_at?: string
          id?: never
          new_status?: string
          old_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "church_status_audit_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "church_status_audit_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      churches: {
        Row: {
          address: string | null
          created_at: string
          created_by: string
          description: string | null
          id: number
          name: string
          name_ne: string | null
          status: string
          status_changed_at: string | null
          status_changed_by: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: never
          name: string
          name_ne?: string | null
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: never
          name?: string
          name_ne?: string | null
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "churches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "churches_status_changed_by_fkey"
            columns: ["status_changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fellowship_preparations: {
        Row: {
          body: string
          church_id: number
          created_at: string
          fellowship_id: number
          id: number
          membership_id: number
          preparation_type: string
          published_at: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          church_id: number
          created_at?: string
          fellowship_id: number
          id?: never
          membership_id: number
          preparation_type?: string
          published_at?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          church_id?: number
          created_at?: string
          fellowship_id?: number
          id?: never
          membership_id?: number
          preparation_type?: string
          published_at?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fellowship_preparations_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fellowship_preparations_fellowship_id_church_id_fkey"
            columns: ["fellowship_id", "church_id"]
            isOneToOne: false
            referencedRelation: "fellowships"
            referencedColumns: ["id", "church_id"]
          },
          {
            foreignKeyName: "fellowship_preparations_membership_id_church_id_fkey"
            columns: ["membership_id", "church_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "church_id"]
          },
          {
            foreignKeyName: "fellowship_preparations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fellowship_service_items: {
        Row: {
          book_code: string | null
          book_name_ne: string | null
          chapter: number | null
          church_id: number
          created_at: string
          created_by: string
          id: number
          item_kind: string
          label: string | null
          note: string | null
          plan_id: number
          position: number
          section: string
          song_id: number | null
          updated_at: string
          verse_end: number | null
          verse_start: number | null
        }
        Insert: {
          book_code?: string | null
          book_name_ne?: string | null
          chapter?: number | null
          church_id: number
          created_at?: string
          created_by: string
          id?: never
          item_kind: string
          label?: string | null
          note?: string | null
          plan_id: number
          position: number
          section: string
          song_id?: number | null
          updated_at?: string
          verse_end?: number | null
          verse_start?: number | null
        }
        Update: {
          book_code?: string | null
          book_name_ne?: string | null
          chapter?: number | null
          church_id?: number
          created_at?: string
          created_by?: string
          id?: never
          item_kind?: string
          label?: string | null
          note?: string | null
          plan_id?: number
          position?: number
          section?: string
          song_id?: number | null
          updated_at?: string
          verse_end?: number | null
          verse_start?: number | null
        }
        Relationships: []
      }
      fellowship_service_plans: {
        Row: {
          church_id: number
          created_at: string
          created_by: string
          fellowship_id: number
          id: number
          published_at: string | null
          published_by: string | null
          sermon_summary: string | null
          sermon_topic: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          church_id: number
          created_at?: string
          created_by: string
          fellowship_id: number
          id?: never
          published_at?: string | null
          published_by?: string | null
          sermon_summary?: string | null
          sermon_topic?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          church_id?: number
          created_at?: string
          created_by?: string
          fellowship_id?: number
          id?: never
          published_at?: string | null
          published_by?: string | null
          sermon_summary?: string | null
          sermon_topic?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      fellowship_staff: {
        Row: {
          assigned_by: string
          church_id: number
          created_at: string
          fellowship_id: number
          id: number
          membership_id: number
          role: string
          updated_at: string
        }
        Insert: {
          assigned_by: string
          church_id: number
          created_at?: string
          fellowship_id: number
          id?: never
          membership_id: number
          role: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string
          church_id?: number
          created_at?: string
          fellowship_id?: number
          id?: never
          membership_id?: number
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fellowship_staff_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fellowship_staff_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fellowship_staff_fellowship_id_church_id_fkey"
            columns: ["fellowship_id", "church_id"]
            isOneToOne: false
            referencedRelation: "fellowships"
            referencedColumns: ["id", "church_id"]
          },
          {
            foreignKeyName: "fellowship_staff_membership_id_church_id_fkey"
            columns: ["membership_id", "church_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id", "church_id"]
          },
        ]
      }
      fellowships: {
        Row: {
          address: string | null
          church_id: number
          created_at: string
          created_by: string
          ends_at: string | null
          host_membership_id: number | null
          id: number
          location_name: string | null
          recurrence_rule: string | null
          starts_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          church_id: number
          created_at?: string
          created_by: string
          ends_at?: string | null
          host_membership_id?: number | null
          id?: never
          location_name?: string | null
          recurrence_rule?: string | null
          starts_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          church_id?: number
          created_at?: string
          created_by?: string
          ends_at?: string | null
          host_membership_id?: number | null
          id?: never
          location_name?: string | null
          recurrence_rule?: string | null
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fellowships_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fellowships_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fellowships_host_membership_id_fkey"
            columns: ["host_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_join_requests: {
        Row: {
          church_id: number | null
          created_at: string
          id: number
          invite_id: number | null
          membership_id: number | null
          request_status: string
          requested_role: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          submitted_code_hash: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          church_id?: number | null
          created_at?: string
          id?: never
          invite_id?: number | null
          membership_id?: number | null
          request_status?: string
          requested_role?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_code_hash?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          church_id?: number | null
          created_at?: string
          id?: never
          invite_id?: number | null
          membership_id?: number | null
          request_status?: string
          requested_role?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_code_hash?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_join_requests_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_join_requests_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "church_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_join_requests_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_role_audit: {
        Row: {
          actor_user_id: string | null
          church_id: number
          created_at: string
          id: number
          membership_id: number | null
          new_role: string | null
          new_status: string | null
          old_role: string | null
          old_status: string | null
          operation: string
          target_user_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          church_id: number
          created_at?: string
          id?: never
          membership_id?: number | null
          new_role?: string | null
          new_status?: string | null
          old_role?: string | null
          old_status?: string | null
          operation: string
          target_user_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          church_id?: number
          created_at?: string
          id?: never
          membership_id?: number | null
          new_role?: string | null
          new_status?: string | null
          old_role?: string | null
          old_status?: string | null
          operation?: string
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_role_audit_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_role_audit_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_role_audit_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_role_audit_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_fellowship_notes: {
        Row: { body: string; church_id: number; created_at: string; fellowship_id: number; id: number; updated_at: string; user_id: string }
        Insert: { body?: string; church_id: number; created_at?: string; fellowship_id: number; id?: never; updated_at?: string; user_id: string }
        Update: { body?: string; church_id?: number; created_at?: string; fellowship_id?: number; id?: never; updated_at?: string; user_id?: string }
        Relationships: []
      }
      member_verse_highlights: {
        Row: { book_code: string; book_name_ne: string; chapter: number; church_id: number; color: string; created_at: string; fellowship_id: number; id: number; reflection: string | null; selected_text: string; updated_at: string; user_id: string; verse_end: number; verse_start: number }
        Insert: { book_code: string; book_name_ne: string; chapter: number; church_id: number; color?: string; created_at?: string; fellowship_id: number; id?: never; reflection?: string | null; selected_text: string; updated_at?: string; user_id: string; verse_end: number; verse_start: number }
        Update: { book_code?: string; book_name_ne?: string; chapter?: number; church_id?: number; color?: string; created_at?: string; fellowship_id?: number; id?: never; reflection?: string | null; selected_text?: string; updated_at?: string; user_id?: string; verse_end?: number; verse_start?: number }
        Relationships: []
      }
      member_voice_notes: {
        Row: { caption: string | null; church_id: number; created_at: string; duration_seconds: number; fellowship_id: number; id: number; mime_type: string; size_bytes: number; storage_path: string; user_id: string }
        Insert: { caption?: string | null; church_id: number; created_at?: string; duration_seconds: number; fellowship_id: number; id?: never; mime_type: string; size_bytes: number; storage_path: string; user_id: string }
        Update: { caption?: string | null; church_id?: number; created_at?: string; duration_seconds?: number; fellowship_id?: number; id?: never; mime_type?: string; size_bytes?: number; storage_path?: string; user_id?: string }
        Relationships: []
      }
      memberships: {
        Row: {
          church_id: number
          id: number
          joined_at: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          church_id: number
          id?: never
          joined_at?: string
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          church_id?: number
          id?: never
          joined_at?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ministry_roles: {
        Row: {
          code: string
          id: number
          is_active: boolean
          name_en: string
          name_ne: string
          sort_order: number
        }
        Insert: {
          code: string
          id?: never
          is_active?: boolean
          name_en: string
          name_ne: string
          sort_order?: number
        }
        Update: {
          code?: string
          id?: never
          is_active?: boolean
          name_en?: string
          name_ne?: string
          sort_order?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_user_id: string | null
          body: string
          church_id: number
          created_at: string
          event_type: string
          id: number
          read_at: string | null
          recipient_user_id: string
          route: string
          source_id: number
          source_table: string
          title: string
        }
        Insert: {
          actor_user_id?: string | null
          body: string
          church_id: number
          created_at?: string
          event_type: string
          id?: never
          read_at?: string | null
          recipient_user_id: string
          route: string
          source_id: number
          source_table: string
          title: string
        }
        Update: {
          actor_user_id?: string | null
          body?: string
          church_id?: number
          created_at?: string
          event_type?: string
          id?: never
          read_at?: string | null
          recipient_user_id?: string
          route?: string
          source_id?: number
          source_table?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_church_id_recipient_user_id_fkey"
            columns: ["church_id", "recipient_user_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["church_id", "user_id"]
          },
          {
            foreignKeyName: "notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_roles: {
        Row: {
          created_at: string
          created_by: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_roles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      preparation_review_audit: {
        Row: {
          action: string
          actor_user_id: string | null
          church_id: number
          created_at: string
          id: number
          next_status: string
          note: string | null
          preparation_id: number
          previous_status: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          church_id: number
          created_at?: string
          id?: never
          next_status: string
          note?: string | null
          preparation_id: number
          previous_status?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          church_id?: number
          created_at?: string
          id?: never
          next_status?: string
          note?: string | null
          preparation_id?: number
          previous_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preparation_review_audit_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preparation_review_audit_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preparation_review_audit_preparation_id_fkey"
            columns: ["preparation_id"]
            isOneToOne: false
            referencedRelation: "fellowship_preparations"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_private: {
        Row: {
          created_at: string
          date_of_birth: string | null
          gender: string | null
          high_contrast: boolean
          id: string
          permanent_address: string | null
          phone: string | null
          temporary_address: string | null
          text_scale_override: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          gender?: string | null
          high_contrast?: boolean
          id: string
          permanent_address?: string | null
          phone?: string | null
          temporary_address?: string | null
          text_scale_override?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          gender?: string | null
          high_contrast?: boolean
          id?: string
          permanent_address?: string | null
          phone?: string | null
          temporary_address?: string | null
          text_scale_override?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_private_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          preferred_language: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          preferred_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      recap_items: {
        Row: {
          bible_reference_id: number | null
          created_at: string
          id: number
          kind: string
          notes: string | null
          position: number
          recap_id: number
          song_id: number | null
        }
        Insert: {
          bible_reference_id?: number | null
          created_at?: string
          id?: never
          kind: string
          notes?: string | null
          position?: number
          recap_id: number
          song_id?: number | null
        }
        Update: {
          bible_reference_id?: number | null
          created_at?: string
          id?: never
          kind?: string
          notes?: string | null
          position?: number
          recap_id?: number
          song_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recap_items_bible_reference_id_fkey"
            columns: ["bible_reference_id"]
            isOneToOne: false
            referencedRelation: "bible_references"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recap_items_recap_id_fkey"
            columns: ["recap_id"]
            isOneToOne: false
            referencedRelation: "recaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recap_items_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      recap_publication_audit: {
        Row: {
          action: string
          actor_id: string | null
          church_id: number
          fellowship_id: number
          id: number
          new_status: string | null
          occurred_at: string
          previous_status: string | null
          recap_id: number | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          church_id: number
          fellowship_id: number
          id?: never
          new_status?: string | null
          occurred_at?: string
          previous_status?: string | null
          recap_id?: number | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          church_id?: number
          fellowship_id?: number
          id?: never
          new_status?: string | null
          occurred_at?: string
          previous_status?: string | null
          recap_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recap_publication_audit_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recap_publication_audit_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      recaps: {
        Row: {
          archived_at: string | null
          author_id: string
          church_id: number
          created_at: string
          fellowship_id: number
          id: number
          message_notes: string
          prayer_points: string[]
          published_at: string | null
          published_by: string | null
          scripture_references: Json
          song_external_ids: string[]
          status: string
          testimony: string | null
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          author_id: string
          church_id: number
          created_at?: string
          fellowship_id: number
          id?: never
          message_notes: string
          prayer_points?: string[]
          published_at?: string | null
          published_by?: string | null
          scripture_references?: Json
          song_external_ids?: string[]
          status?: string
          testimony?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          author_id?: string
          church_id?: number
          created_at?: string
          fellowship_id?: number
          id?: never
          message_notes?: string | null
          prayer_points?: string[]
          published_at?: string | null
          published_by?: string | null
          scripture_references?: Json
          song_external_ids?: string[]
          status?: string
          testimony?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recaps_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recaps_fellowship_id_fkey"
            columns: ["fellowship_id"]
            isOneToOne: true
            referencedRelation: "fellowships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recaps_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      song_favorites: {
        Row: {
          created_at: string
          song_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          song_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          song_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "song_favorites_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "song_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      worship_artists: {
        Row: {
          created_at: string
          description: string | null
          external_id: string
          external_source: string
          id: number
          name: string
          original_created_at: string | null
          photo_url: string | null
          source_payload: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          external_id: string
          external_source: string
          id?: never
          name: string
          original_created_at?: string | null
          photo_url?: string | null
          source_payload?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          external_id?: string
          external_source?: string
          id?: never
          name?: string
          original_created_at?: string | null
          photo_url?: string | null
          source_payload?: Json
          updated_at?: string
        }
        Relationships: []
      }
      songs: {
        Row: {
          artist_credit: string | null
          artist_id: number | null
          audio_url: string | null
          beat: string | null
          category: string
          chords: string | null
          church_id: number | null
          created_at: string
          created_by: string | null
          description: string | null
          external_id: string | null
          external_source: string | null
          id: number
          is_published: boolean
          license_note: string | null
          lyrics_ne: string
          lyrics_romanized: string | null
          lyrics_transliterated: string | null
          original_created_at: string | null
          original_updated_at: string | null
          song_language: string | null
          song_number: number | null
          song_type: string | null
          source_name: string | null
          source_payload: Json | null
          source_url: string | null
          title_ne: string
          title_romanized: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          artist_credit?: string | null
          artist_id?: number | null
          audio_url?: string | null
          beat?: string | null
          category?: string
          chords?: string | null
          church_id?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          external_id?: string | null
          external_source?: string | null
          id?: never
          is_published?: boolean
          license_note?: string | null
          lyrics_ne: string
          lyrics_romanized?: string | null
          lyrics_transliterated?: string | null
          original_created_at?: string | null
          original_updated_at?: string | null
          song_language?: string | null
          song_number?: number | null
          song_type?: string | null
          source_name?: string | null
          source_payload?: Json | null
          source_url?: string | null
          title_ne: string
          title_romanized?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          artist_credit?: string | null
          artist_id?: number | null
          audio_url?: string | null
          beat?: string | null
          category?: string
          chords?: string | null
          church_id?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          external_id?: string | null
          external_source?: string | null
          id?: never
          is_published?: boolean
          license_note?: string | null
          lyrics_ne?: string
          lyrics_romanized?: string | null
          lyrics_transliterated?: string | null
          original_created_at?: string | null
          original_updated_at?: string | null
          song_language?: string | null
          song_number?: number | null
          song_type?: string | null
          source_name?: string | null
          source_payload?: Json | null
          source_url?: string | null
          title_ne?: string
          title_romanized?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "songs_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "worship_artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "songs_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "songs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_post_preparations: {
        Args: never
        Returns: boolean
      }
      fellowship_service_capabilities: {
        Args: { p_fellowship_id: number }
        Returns: {
          can_manage_program: boolean
          can_prepare_sermon: boolean
          can_prepare_worship: boolean
          can_view: boolean
        }[]
      }
      list_fellowship_service_slides: {
        Args: { p_fellowship_id: number }
        Returns: {
          book_code: string
          book_name_ne: string
          chapter: number
          church_id: number
          fellowship_id: number
          fellowship_starts_at: string
          fellowship_title: string
          item_id: number
          item_kind: string
          item_label: string
          item_note: string
          plan_id: number
          plan_status: string
          plan_title: string
          preacher_name: string
          section: string
          sermon_summary: string
          sermon_topic: string
          slide_position: number
          song_chords: string
          song_external_id: string
          song_id: number
          song_key: string
          song_lyrics: string
          song_number: number
          song_title: string
          song_type: string
          verse_end: number
          verse_start: number
        }[]
      }
      provision_church: {
        Args: {
          p_address?: string | null
          p_admin_email: string
          p_name: string
          p_name_ne?: string | null
        }
        Returns: {
          admin_email: string
          admin_user_id: string
          church_id: number
          church_name: string
        }[]
      }
      review_membership_request: {
        Args: {
          p_decision: string
          p_request_id: number
          p_review_note?: string | null
        }
        Returns: {
          membership_id: number | null
          request_id: number
          request_status: string
        }[]
      }
      list_admin_churches: {
        Args: never
        Returns: {
          address: string
          church_id: number
          church_name: string
          church_name_ne: string
          created_at: string
          fellowship_count: number
          member_count: number
          my_role: string
          status: string
          updated_at: string
        }[]
      }
      list_church_members: {
        Args: {
          p_church_id: number
          p_page_offset?: number
          p_page_size?: number
          p_search_text?: string
        }
        Returns: {
          avatar_url: string
          full_name: string
          joined_at: string
          membership_id: number
          role: string
          total_count: number
          user_id: string
        }[]
      }
      list_joinable_churches: {
        Args: never
        Returns: {
          address: string | null
          church_id: number
          church_name: string
          church_name_ne: string | null
        }[]
      }
      list_my_membership_requests: {
        Args: never
        Returns: {
          church_id: number
          church_name: string
          church_name_ne: string | null
          created_at: string
          request_id: number
          request_status: string
          requested_role: string
          review_note: string | null
          reviewed_at: string | null
        }[]
      }
      list_pending_membership_requests: {
        Args: { p_church_id: number }
        Returns: {
          avatar_url: string | null
          created_at: string
          full_name: string
          request_id: number
          requested_role: string
          user_id: string
        }[]
      }
      list_fellowship_assignments: {
        Args: { p_fellowship_id: number }
        Returns: {
          assignment_id: number
          assignment_status: string
          completed_at: string | null
          created_at: string
          member_membership_id: number
          member_name: string
          ministry_role_code: string
          ministry_role_id: number
          ministry_role_name_ne: string
          notes: string | null
          responded_at: string | null
        }[]
      }
      list_my_assignments: {
        Args: { p_limit?: number; p_membership_id: number }
        Returns: {
          address: string | null
          assignment_id: number
          assignment_status: string
          completed_at: string | null
          created_at: string
          ends_at: string | null
          fellowship_id: number
          fellowship_status: string
          fellowship_title: string
          location_name: string | null
          ministry_role_code: string
          ministry_role_id: number
          ministry_role_name_ne: string
          notes: string | null
          responded_at: string | null
          starts_at: string
          updated_at: string
        }[]
      }
      list_my_notifications: {
        Args: { p_limit?: number }
        Returns: {
          body: string
          church_id: number
          church_name: string
          church_name_ne: string | null
          created_at: string
          event_type: string
          notification_id: number
          read_at: string | null
          route: string
          source_id: number
          source_table: string
          title: string
        }[]
      }
      notification_unread_count: {
        Args: never
        Returns: number
      }
      list_my_preparations: {
        Args: { p_limit?: number; p_membership_id: number }
        Returns: {
          body: string
          fellowship_id: number
          fellowship_title: string
          id: number
          preparation_type: string
          published_at: string | null
          review_note: string | null
          status: string
          submitted_at: string | null
          title: string
          updated_at: string
        }[]
      }
      list_preparation_feed: {
        Args: { p_church_id: number; p_limit?: number }
        Returns: {
          author_name: string
          body: string
          fellowship_id: number
          fellowship_title: string
          id: number
          preparation_type: string
          published_at: string
          title: string
        }[]
      }
      list_preparation_queue: {
        Args: { p_church_id: number; p_limit?: number }
        Returns: {
          author_name: string
          body: string
          fellowship_id: number
          fellowship_title: string
          id: number
          preparation_type: string
          submitted_at: string
          title: string
        }[]
      }
      list_preparation_posting_fellowships: {
        Args: { p_membership_id: number }
        Returns: {
          id: number
          starts_at: string
          status: string
          title: string
        }[]
      }
      list_manageable_recaps: {
        Args: { p_church_id: number }
        Returns: {
          archived_at: string | null
          church_id: number
          fellowship_id: number
          fellowship_title: string
          id: number
          prayer_points: string[]
          published_at: string | null
          scripture_references: Json
          song_external_ids: string[]
          status: string
          summary: string
          testimony: string | null
          title: string
          updated_at: string
        }[]
      }
      list_fellowship_attendance: {
        Args: { p_fellowship_id: number }
        Returns: {
          attendance_id: number | null
          attendance_notes: string | null
          attendance_status: string
          marked_at: string | null
          member_name: string
          membership_id: number
          membership_role: string
          user_id: string
        }[]
      }
      list_my_attendance: {
        Args: { p_church_id: number; p_limit?: number }
        Returns: {
          attendance_id: number
          attendance_notes: string | null
          attendance_status: string
          fellowship_id: number
          fellowship_starts_at: string
          fellowship_title: string
          marked_at: string
        }[]
      }
      list_published_recaps: {
        Args: { p_church_id: number; p_limit?: number }
        Returns: {
          author_name: string
          church_id: number
          fellowship_id: number
          fellowship_starts_at: string
          fellowship_title: string
          id: number
          prayer_points: string[]
          published_at: string
          scripture_references: Json
          song_external_ids: string[]
          summary: string
          testimony: string | null
          title: string
        }[]
      }
      search_worship_songs: {
        Args: {
          p_external_ids?: string[] | null
          p_page_offset?: number
          p_page_size?: number
          p_search_text?: string | null
          p_song_type?: string | null
        }
        Returns: {
          artist_credit: string | null
          beat: string | null
          category: string
          external_id: string
          has_chords: boolean
          id: number
          song_key: string | null
          song_language: string | null
          song_number: number | null
          song_type: string | null
          title_ne: string
          title_romanized: string | null
          total_count: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
