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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      access_stats: {
        Row: {
          client_id: string
          created_at: string
          id: string
          imported_by: string | null
          metrics: Json
          org_id: string
          period_end: string
          period_start: string
          release_id: string | null
          source_document_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          imported_by?: string | null
          metrics: Json
          org_id: string
          period_end: string
          period_start: string
          release_id?: string | null
          source_document_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          imported_by?: string | null
          metrics?: Json
          org_id?: string
          period_end?: string
          period_start?: string
          release_id?: string | null
          source_document_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_stats_client_id_release_id_fkey"
            columns: ["client_id", "release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["client_id", "id"]
          },
          {
            foreignKeyName: "access_stats_org_id_client_id_fkey"
            columns: ["org_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "access_stats_org_id_imported_by_fkey"
            columns: ["org_id", "imported_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "access_stats_org_id_source_document_id_fkey"
            columns: ["org_id", "source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      approvals: {
        Row: {
          action: Database["public"]["Enums"]["approval_action"]
          actor_id: string
          artifact_version_id: string
          comment: string | null
          created_at: string
          id: string
          org_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["approval_action"]
          actor_id: string
          artifact_version_id: string
          comment?: string | null
          created_at?: string
          id?: string
          org_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["approval_action"]
          actor_id?: string
          artifact_version_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_org_id_actor_id_fkey"
            columns: ["org_id", "actor_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "approvals_org_id_artifact_version_id_fkey"
            columns: ["org_id", "artifact_version_id"]
            isOneToOne: false
            referencedRelation: "artifact_versions"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      artifact_versions: {
        Row: {
          artifact_id: string
          content: Json
          created_at: string
          created_by: string | null
          generation_id: string | null
          id: string
          org_id: string
          origin: Database["public"]["Enums"]["version_origin"]
          parent_version_id: string | null
          version: number
        }
        Insert: {
          artifact_id: string
          content: Json
          created_at?: string
          created_by?: string | null
          generation_id?: string | null
          id?: string
          org_id?: string
          origin: Database["public"]["Enums"]["version_origin"]
          parent_version_id?: string | null
          version?: number
        }
        Update: {
          artifact_id?: string
          content?: Json
          created_at?: string
          created_by?: string | null
          generation_id?: string | null
          id?: string
          org_id?: string
          origin?: Database["public"]["Enums"]["version_origin"]
          parent_version_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "artifact_versions_artifact_id_parent_version_id_fkey"
            columns: ["artifact_id", "parent_version_id"]
            isOneToOne: false
            referencedRelation: "artifact_versions"
            referencedColumns: ["artifact_id", "id"]
          },
          {
            foreignKeyName: "artifact_versions_org_id_artifact_id_fkey"
            columns: ["org_id", "artifact_id"]
            isOneToOne: false
            referencedRelation: "artifacts"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "artifact_versions_org_id_created_by_fkey"
            columns: ["org_id", "created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "artifact_versions_org_id_generation_id_fkey"
            columns: ["org_id", "generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      artifacts: {
        Row: {
          approved_version_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          release_id: string | null
          status: Database["public"]["Enums"]["artifact_status"]
          title: string
          type: Database["public"]["Enums"]["artifact_type"]
          updated_at: string
        }
        Insert: {
          approved_version_id?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          release_id?: string | null
          status?: Database["public"]["Enums"]["artifact_status"]
          title: string
          type: Database["public"]["Enums"]["artifact_type"]
          updated_at?: string
        }
        Update: {
          approved_version_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          release_id?: string | null
          status?: Database["public"]["Enums"]["artifact_status"]
          title?: string
          type?: Database["public"]["Enums"]["artifact_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "artifacts_approved_version_fkey"
            columns: ["id", "approved_version_id"]
            isOneToOne: false
            referencedRelation: "artifact_versions"
            referencedColumns: ["artifact_id", "id"]
          },
          {
            foreignKeyName: "artifacts_client_id_release_id_fkey"
            columns: ["client_id", "release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["client_id", "id"]
          },
          {
            foreignKeyName: "artifacts_org_id_client_id_fkey"
            columns: ["org_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "artifacts_org_id_created_by_fkey"
            columns: ["org_id", "created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          email: string | null
          id: string
          is_spokesperson: boolean
          name: string
          org_id: string
          title: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_spokesperson?: boolean
          name: string
          org_id?: string
          title?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_spokesperson?: boolean
          name?: string
          org_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_org_id_client_id_fkey"
            columns: ["org_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          id: string
          industry: string | null
          name: string
          onboarded_externally: boolean
          org_id: string
          owner_id: string | null
          profile: Json
          release_cadence: string | null
          tier: Database["public"]["Enums"]["tier"]
          website: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          industry?: string | null
          name: string
          onboarded_externally?: boolean
          org_id?: string
          owner_id?: string | null
          profile?: Json
          release_cadence?: string | null
          tier: Database["public"]["Enums"]["tier"]
          website?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          industry?: string | null
          name?: string
          onboarded_externally?: boolean
          org_id?: string
          owner_id?: string | null
          profile?: Json
          release_cadence?: string | null
          tier?: Database["public"]["Enums"]["tier"]
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_org_id_owner_id_fkey"
            columns: ["org_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      core_lists: {
        Row: {
          added_by: string | null
          client_id: string
          created_at: string
          id: string
          journalist_id: string
          org_id: string
        }
        Insert: {
          added_by?: string | null
          client_id: string
          created_at?: string
          id?: string
          journalist_id: string
          org_id?: string
        }
        Update: {
          added_by?: string | null
          client_id?: string
          created_at?: string
          id?: string
          journalist_id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "core_lists_org_id_added_by_fkey"
            columns: ["org_id", "added_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "core_lists_org_id_client_id_fkey"
            columns: ["org_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "core_lists_org_id_journalist_id_fkey"
            columns: ["org_id", "journalist_id"]
            isOneToOne: false
            referencedRelation: "journalists"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      coverage: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          journalist_id: string | null
          org_id: string
          outlet_id: string | null
          published_on: string | null
          release_id: string | null
          title: string | null
          type: Database["public"]["Enums"]["coverage_type"]
          url: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          journalist_id?: string | null
          org_id?: string
          outlet_id?: string | null
          published_on?: string | null
          release_id?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["coverage_type"]
          url: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          journalist_id?: string | null
          org_id?: string
          outlet_id?: string | null
          published_on?: string | null
          release_id?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["coverage_type"]
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "coverage_client_id_release_id_fkey"
            columns: ["client_id", "release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["client_id", "id"]
          },
          {
            foreignKeyName: "coverage_org_id_client_id_fkey"
            columns: ["org_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "coverage_org_id_created_by_fkey"
            columns: ["org_id", "created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "coverage_org_id_journalist_id_fkey"
            columns: ["org_id", "journalist_id"]
            isOneToOne: false
            referencedRelation: "journalists"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "coverage_org_id_outlet_id_fkey"
            columns: ["org_id", "outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          chunk_index: number
          client_id: string | null
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          fts: unknown
          id: string
          org_id: string
          tokens: number | null
        }
        Insert: {
          chunk_index: number
          client_id?: string | null
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          fts?: unknown
          id?: string
          org_id: string
          tokens?: number | null
        }
        Update: {
          chunk_index?: number
          client_id?: string | null
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          fts?: unknown
          id?: string
          org_id?: string
          tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_org_id_document_id_fkey"
            columns: ["org_id", "document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      documents: {
        Row: {
          bucket: string
          client_id: string | null
          created_at: string
          created_by: string | null
          email_id: string | null
          id: string
          index_error: string | null
          index_status: Database["public"]["Enums"]["index_status"]
          indexed_at: string | null
          mime: string | null
          org_id: string
          size_bytes: number | null
          source: Database["public"]["Enums"]["document_source"]
          storage_path: string
          title: string
        }
        Insert: {
          bucket: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          email_id?: string | null
          id?: string
          index_error?: string | null
          index_status?: Database["public"]["Enums"]["index_status"]
          indexed_at?: string | null
          mime?: string | null
          org_id?: string
          size_bytes?: number | null
          source: Database["public"]["Enums"]["document_source"]
          storage_path: string
          title: string
        }
        Update: {
          bucket?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          email_id?: string | null
          id?: string
          index_error?: string | null
          index_status?: Database["public"]["Enums"]["index_status"]
          indexed_at?: string | null
          mime?: string | null
          org_id?: string
          size_bytes?: number | null
          source?: Database["public"]["Enums"]["document_source"]
          storage_path?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_email_fkey"
            columns: ["org_id", "email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "documents_org_id_client_id_fkey"
            columns: ["org_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "documents_org_id_created_by_fkey"
            columns: ["org_id", "created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      emails: {
        Row: {
          body_html: string | null
          body_text: string | null
          cc_addresses: string[]
          classified_at: string | null
          classified_by: string | null
          client_id: string | null
          confidence: number | null
          created_at: string
          extracted: Json
          from_address: string | null
          from_name: string | null
          handled_at: string | null
          handled_by: string | null
          has_attachments: boolean
          id: string
          internet_message_id: string | null
          label: Database["public"]["Enums"]["email_label"] | null
          mail_account_id: string | null
          org_id: string
          owner_id: string | null
          provider_message_id: string
          received_at: string | null
          status: Database["public"]["Enums"]["email_status"]
          subject: string | null
          suggested_action: string | null
          thread_id: string | null
          to_addresses: string[]
          updated_at: string
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          cc_addresses?: string[]
          classified_at?: string | null
          classified_by?: string | null
          client_id?: string | null
          confidence?: number | null
          created_at?: string
          extracted?: Json
          from_address?: string | null
          from_name?: string | null
          handled_at?: string | null
          handled_by?: string | null
          has_attachments?: boolean
          id?: string
          internet_message_id?: string | null
          label?: Database["public"]["Enums"]["email_label"] | null
          mail_account_id?: string | null
          org_id: string
          owner_id?: string | null
          provider_message_id: string
          received_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string | null
          suggested_action?: string | null
          thread_id?: string | null
          to_addresses?: string[]
          updated_at?: string
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          cc_addresses?: string[]
          classified_at?: string | null
          classified_by?: string | null
          client_id?: string | null
          confidence?: number | null
          created_at?: string
          extracted?: Json
          from_address?: string | null
          from_name?: string | null
          handled_at?: string | null
          handled_by?: string | null
          has_attachments?: boolean
          id?: string
          internet_message_id?: string | null
          label?: Database["public"]["Enums"]["email_label"] | null
          mail_account_id?: string | null
          org_id?: string
          owner_id?: string | null
          provider_message_id?: string
          received_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string | null
          suggested_action?: string | null
          thread_id?: string | null
          to_addresses?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "emails_org_id_client_id_fkey"
            columns: ["org_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "emails_org_id_handled_by_fkey"
            columns: ["org_id", "handled_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "emails_org_id_mail_account_id_fkey"
            columns: ["org_id", "mail_account_id"]
            isOneToOne: false
            referencedRelation: "mail_accounts"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "emails_org_id_owner_id_fkey"
            columns: ["org_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      frameworks: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          example_artifact_id: string | null
          id: string
          is_active: boolean
          is_placeholder: boolean
          kind: Database["public"]["Enums"]["framework_kind"]
          org_id: string
          title: string
          version: number
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          example_artifact_id?: string | null
          id?: string
          is_active?: boolean
          is_placeholder?: boolean
          kind: Database["public"]["Enums"]["framework_kind"]
          org_id?: string
          title: string
          version: number
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          example_artifact_id?: string | null
          id?: string
          is_active?: boolean
          is_placeholder?: boolean
          kind?: Database["public"]["Enums"]["framework_kind"]
          org_id?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "frameworks_org_id_created_by_fkey"
            columns: ["org_id", "created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "frameworks_org_id_example_artifact_id_fkey"
            columns: ["org_id", "example_artifact_id"]
            isOneToOne: false
            referencedRelation: "artifacts"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      generations: {
        Row: {
          cache_creation_input_tokens: number | null
          cache_read_input_tokens: number | null
          cost_usd: number | null
          created_at: string
          error: string | null
          framework_id: string | null
          id: string
          input_tokens: number | null
          inputs: Json
          job_id: string | null
          latency_ms: number | null
          model: string
          org_id: string
          output_tokens: number | null
          request_id: string | null
          stop_reason: string | null
          task: string
        }
        Insert: {
          cache_creation_input_tokens?: number | null
          cache_read_input_tokens?: number | null
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          framework_id?: string | null
          id?: string
          input_tokens?: number | null
          inputs?: Json
          job_id?: string | null
          latency_ms?: number | null
          model: string
          org_id: string
          output_tokens?: number | null
          request_id?: string | null
          stop_reason?: string | null
          task: string
        }
        Update: {
          cache_creation_input_tokens?: number | null
          cache_read_input_tokens?: number | null
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          framework_id?: string | null
          id?: string
          input_tokens?: number | null
          inputs?: Json
          job_id?: string | null
          latency_ms?: number | null
          model?: string
          org_id?: string
          output_tokens?: number | null
          request_id?: string | null
          stop_reason?: string | null
          task?: string
        }
        Relationships: [
          {
            foreignKeyName: "generations_org_id_framework_id_fkey"
            columns: ["org_id", "framework_id"]
            isOneToOne: false
            referencedRelation: "frameworks"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "generations_org_id_job_id_fkey"
            columns: ["org_id", "job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      inbox_duty: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          member_id: string
          org_id: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          member_id: string
          org_id?: string
          starts_at: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          member_id?: string
          org_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_duty_org_id_member_id_fkey"
            columns: ["org_id", "member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      jobs: {
        Row: {
          artifact_id: string | null
          attempts: number
          client_id: string | null
          created_at: string
          created_by: string | null
          dedupe_key: string | null
          error: string | null
          finished_at: string | null
          id: string
          input: Json
          max_attempts: number
          msg_id: number | null
          org_id: string
          output: Json | null
          progress: number
          progress_message: string | null
          release_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          type: string
          updated_at: string
        }
        Insert: {
          artifact_id?: string | null
          attempts?: number
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          max_attempts?: number
          msg_id?: number | null
          org_id: string
          output?: Json | null
          progress?: number
          progress_message?: string | null
          release_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          type: string
          updated_at?: string
        }
        Update: {
          artifact_id?: string | null
          attempts?: number
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          max_attempts?: number
          msg_id?: number | null
          org_id?: string
          output?: Json | null
          progress?: number
          progress_message?: string | null
          release_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_release_id_fkey"
            columns: ["client_id", "release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["client_id", "id"]
          },
          {
            foreignKeyName: "jobs_org_id_artifact_id_fkey"
            columns: ["org_id", "artifact_id"]
            isOneToOne: false
            referencedRelation: "artifacts"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "jobs_org_id_client_id_fkey"
            columns: ["org_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "jobs_org_id_created_by_fkey"
            columns: ["org_id", "created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      journalists: {
        Row: {
          beats: string[]
          created_at: string
          do_not_contact: boolean
          do_not_contact_reason: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          org_id: string
          outlet_id: string | null
          source: string
          title: string | null
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          beats?: string[]
          created_at?: string
          do_not_contact?: boolean
          do_not_contact_reason?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          org_id?: string
          outlet_id?: string | null
          source?: string
          title?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          beats?: string[]
          created_at?: string
          do_not_contact?: boolean
          do_not_contact_reason?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          outlet_id?: string | null
          source?: string
          title?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journalists_org_id_outlet_id_fkey"
            columns: ["org_id", "outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      mail_accounts: {
        Row: {
          client_state: string
          created_at: string
          delta_link: string | null
          id: string
          last_error: string | null
          last_synced_at: string | null
          mailbox: string
          org_id: string
          provider: string
          subscription_expires_at: string | null
          subscription_id: string | null
        }
        Insert: {
          client_state?: string
          created_at?: string
          delta_link?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          mailbox: string
          org_id?: string
          provider?: string
          subscription_expires_at?: string | null
          subscription_id?: string | null
        }
        Update: {
          client_state?: string
          created_at?: string
          delta_link?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          mailbox?: string
          org_id?: string
          provider?: string
          subscription_expires_at?: string | null
          subscription_id?: string | null
        }
        Relationships: []
      }
      media_list_entries: {
        Row: {
          artifact_version_id: string
          created_at: string
          id: string
          included: boolean
          journalist_id: string
          org_id: string
          position: number
          relevance_reason: string | null
        }
        Insert: {
          artifact_version_id: string
          created_at?: string
          id?: string
          included?: boolean
          journalist_id: string
          org_id: string
          position: number
          relevance_reason?: string | null
        }
        Update: {
          artifact_version_id?: string
          created_at?: string
          id?: string
          included?: boolean
          journalist_id?: string
          org_id?: string
          position?: number
          relevance_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_list_entries_org_id_artifact_version_id_fkey"
            columns: ["org_id", "artifact_version_id"]
            isOneToOne: false
            referencedRelation: "artifact_versions"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "media_list_entries_org_id_journalist_id_fkey"
            columns: ["org_id", "journalist_id"]
            isOneToOne: false
            referencedRelation: "journalists"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      meetings: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          document_id: string | null
          held_on: string | null
          id: string
          kind: Database["public"]["Enums"]["meeting_kind"]
          notes: string | null
          org_id: string
          scheduled_for: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          held_on?: string | null
          id?: string
          kind: Database["public"]["Enums"]["meeting_kind"]
          notes?: string | null
          org_id?: string
          scheduled_for?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          held_on?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["meeting_kind"]
          notes?: string | null
          org_id?: string
          scheduled_for?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_org_id_client_id_fkey"
            columns: ["org_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "meetings_org_id_created_by_fkey"
            columns: ["org_id", "created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "meetings_org_id_document_id_fkey"
            columns: ["org_id", "document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      org_settings: {
        Row: {
          access_csv_columns: Json
          classify_threshold: number
          created_at: string
          org_id: string
          updated_at: string
        }
        Insert: {
          access_csv_columns?: Json
          classify_threshold?: number
          created_at?: string
          org_id?: string
          updated_at?: string
        }
        Update: {
          access_csv_columns?: Json
          classify_threshold?: number
          created_at?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      outlets: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
          region: string | null
          type: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id?: string
          region?: string | null
          type?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          region?: string | null
          type?: string | null
          url?: string | null
        }
        Relationships: []
      }
      outreach: {
        Row: {
          client_id: string
          created_at: string
          id: string
          journalist_id: string
          notes: string | null
          org_id: string
          outcome: Database["public"]["Enums"]["outreach_outcome"]
          outcome_at: string | null
          pitch_version_id: string | null
          pitched_at: string
          pitched_by: string | null
          release_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          journalist_id: string
          notes?: string | null
          org_id?: string
          outcome?: Database["public"]["Enums"]["outreach_outcome"]
          outcome_at?: string | null
          pitch_version_id?: string | null
          pitched_at?: string
          pitched_by?: string | null
          release_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          journalist_id?: string
          notes?: string | null
          org_id?: string
          outcome?: Database["public"]["Enums"]["outreach_outcome"]
          outcome_at?: string | null
          pitch_version_id?: string | null
          pitched_at?: string
          pitched_by?: string | null
          release_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_client_id_release_id_fkey"
            columns: ["client_id", "release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["client_id", "id"]
          },
          {
            foreignKeyName: "outreach_org_id_client_id_fkey"
            columns: ["org_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "outreach_org_id_journalist_id_fkey"
            columns: ["org_id", "journalist_id"]
            isOneToOne: false
            referencedRelation: "journalists"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "outreach_org_id_pitch_version_id_fkey"
            columns: ["org_id", "pitch_version_id"]
            isOneToOne: false
            referencedRelation: "artifact_versions"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "outreach_org_id_pitched_by_fkey"
            columns: ["org_id", "pitched_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      releases: {
        Row: {
          access_uploaded_at: string | null
          access_uploaded_by: string | null
          client_id: string
          created_at: string
          created_by: string | null
          due_on: string | null
          id: string
          mode: Database["public"]["Enums"]["release_mode"]
          org_id: string
          roadmap_item: string | null
          source_email_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          access_uploaded_at?: string | null
          access_uploaded_by?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          due_on?: string | null
          id?: string
          mode: Database["public"]["Enums"]["release_mode"]
          org_id?: string
          roadmap_item?: string | null
          source_email_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          access_uploaded_at?: string | null
          access_uploaded_by?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          due_on?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["release_mode"]
          org_id?: string
          roadmap_item?: string | null
          source_email_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "releases_org_id_access_uploaded_by_fkey"
            columns: ["org_id", "access_uploaded_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "releases_org_id_client_id_fkey"
            columns: ["org_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "releases_org_id_created_by_fkey"
            columns: ["org_id", "created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "releases_source_email_fkey"
            columns: ["org_id", "source_email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      sender_rules: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          id: string
          label: Database["public"]["Enums"]["email_label"] | null
          org_id: string
          pattern: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          label?: Database["public"]["Enums"]["email_label"] | null
          org_id?: string
          pattern: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          label?: Database["public"]["Enums"]["email_label"] | null
          org_id?: string
          pattern?: string
        }
        Relationships: [
          {
            foreignKeyName: "sender_rules_org_id_client_id_fkey"
            columns: ["org_id", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "sender_rules_org_id_created_by_fkey"
            columns: ["org_id", "created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      team_members: {
        Row: {
          clerk_user_id: string
          created_at: string
          deactivated_at: string | null
          email: string | null
          id: string
          name: string
          org_id: string
          role: string
          slack_user_id: string | null
          teams_user_id: string | null
        }
        Insert: {
          clerk_user_id: string
          created_at?: string
          deactivated_at?: string | null
          email?: string | null
          id?: string
          name: string
          org_id?: string
          role?: string
          slack_user_id?: string | null
          teams_user_id?: string | null
        }
        Update: {
          clerk_user_id?: string
          created_at?: string
          deactivated_at?: string | null
          email?: string | null
          id?: string
          name?: string
          org_id?: string
          role?: string
          slack_user_id?: string | null
          teams_user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_framework: {
        Args: { p_framework_id: string }
        Returns: undefined
      }
      approve_version: {
        Args: { p_comment?: string; p_version_id: string }
        Returns: undefined
      }
      archive_artifact: { Args: { p_artifact_id: string }; Returns: undefined }
      cancel_job: { Args: { p_job_id: string }; Returns: undefined }
      correct_email: {
        Args: {
          p_client_id: string
          p_email_id: string
          p_label: Database["public"]["Enums"]["email_label"]
          p_remember?: boolean
        }
        Returns: undefined
      }
      create_release: {
        Args: {
          p_client_id: string
          p_due_on?: string
          p_mode?: Database["public"]["Enums"]["release_mode"]
          p_roadmap_item?: string
          p_source_email_id?: string
          p_title: string
        }
        Returns: string
      }
      current_member_id: { Args: never; Returns: string }
      current_org_id: { Args: never; Returns: string }
      current_user_id: { Args: never; Returns: string }
      delete_client: { Args: { p_client_id: string }; Returns: undefined }
      enqueue_job: {
        Args: {
          p_artifact_id?: string
          p_client_id?: string
          p_input?: Json
          p_release_id?: string
          p_type: string
        }
        Returns: string
      }
      enqueue_mail_sync: {
        Args: { p_client_state: string; p_subscription_id: string }
        Returns: boolean
      }
      inbox_duty_at: {
        Args: { p_at?: string; p_org_id: string }
        Returns: string[]
      }
      is_org_admin: { Args: never; Returns: boolean }
      mark_access_uploaded: {
        Args: { p_release_id: string }
        Returns: undefined
      }
      match_chunks: {
        Args: {
          p_client_id: string
          p_match_count?: number
          p_query_embedding: string
          p_query_text: string
        }
        Returns: {
          chunk_id: string
          chunk_index: number
          content: string
          document_id: string
          document_title: string
          score: number
        }[]
      }
      request_changes: {
        Args: { p_comment: string; p_version_id: string }
        Returns: undefined
      }
      save_media_list_version: {
        Args: {
          p_artifact_id: string
          p_content: Json
          p_entries: Json
          p_origin?: Database["public"]["Enums"]["version_origin"]
          p_parent_version_id?: string
        }
        Returns: string
      }
      set_email_handled: {
        Args: { p_email_id: string; p_handled: boolean }
        Returns: undefined
      }
      submit_for_review: {
        Args: { p_comment?: string; p_version_id: string }
        Returns: undefined
      }
      whoami: { Args: never; Returns: Json }
    }
    Enums: {
      approval_action: "submitted" | "approved" | "changes_requested"
      artifact_status: "draft" | "in_review" | "approved" | "archived"
      artifact_type:
        | "research"
        | "onboarding_deck"
        | "strategy"
        | "press_release"
        | "media_list"
        | "pitch_set"
        | "report"
      coverage_type:
        | "article"
        | "broadcast"
        | "podcast"
        | "social"
        | "syndication"
        | "other"
      document_source: "upload" | "email_attachment" | "generated" | "note"
      email_label:
        | "release_info"
        | "client_update"
        | "sales_handoff"
        | "social"
        | "auto_notification"
        | "other"
      email_status: "new" | "routed" | "unmatched" | "handled" | "muted"
      framework_kind:
        | "research"
        | "onboarding_deck"
        | "strategy"
        | "press_release_write"
        | "press_release_edit"
        | "media_list"
        | "pitch_set"
        | "report"
        | "email_classify"
      index_status: "pending" | "indexing" | "indexed" | "failed" | "skipped"
      job_status: "queued" | "running" | "succeeded" | "failed" | "canceled"
      meeting_kind: "meeting_1" | "meeting_2" | "check_in"
      outreach_outcome:
        | "pending"
        | "no_response"
        | "replied"
        | "interested"
        | "declined"
        | "covered"
      release_mode: "write" | "edit"
      tier: "L1" | "L2" | "L3"
      version_origin: "ai" | "human" | "mixed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      approval_action: ["submitted", "approved", "changes_requested"],
      artifact_status: ["draft", "in_review", "approved", "archived"],
      artifact_type: [
        "research",
        "onboarding_deck",
        "strategy",
        "press_release",
        "media_list",
        "pitch_set",
        "report",
      ],
      coverage_type: [
        "article",
        "broadcast",
        "podcast",
        "social",
        "syndication",
        "other",
      ],
      document_source: ["upload", "email_attachment", "generated", "note"],
      email_label: [
        "release_info",
        "client_update",
        "sales_handoff",
        "social",
        "auto_notification",
        "other",
      ],
      email_status: ["new", "routed", "unmatched", "handled", "muted"],
      framework_kind: [
        "research",
        "onboarding_deck",
        "strategy",
        "press_release_write",
        "press_release_edit",
        "media_list",
        "pitch_set",
        "report",
        "email_classify",
      ],
      index_status: ["pending", "indexing", "indexed", "failed", "skipped"],
      job_status: ["queued", "running", "succeeded", "failed", "canceled"],
      meeting_kind: ["meeting_1", "meeting_2", "check_in"],
      outreach_outcome: [
        "pending",
        "no_response",
        "replied",
        "interested",
        "declined",
        "covered",
      ],
      release_mode: ["write", "edit"],
      tier: ["L1", "L2", "L3"],
      version_origin: ["ai", "human", "mixed"],
    },
  },
} as const
