/**
 * Tipos de la base de datos Supabase.
 *
 * Para regenerar automáticamente con la Supabase CLI (recomendado):
 *   npx supabase gen types typescript --project-id TU_PROJECT_ID > types/database.types.ts
 *
 * Los tipos manuales aquí deben coincidir exactamente con el schema de Supabase v2,
 * incluyendo: Relationships, CompositeTypes y el formato de Views/Functions/Enums.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      issue_links: {
        Row: {
          id: string
          source_issue_id: string
          target_issue_id: string
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          source_issue_id: string
          target_issue_id: string
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          source_issue_id?: string
          target_issue_id?: string
          created_by?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          name: string
          key: string
          description: string | null
          owner_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          key: string
          description?: string | null
          owner_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          key?: string
          description?: string | null
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'projects_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      project_members: {
        Row: {
          id: string
          project_id: string
          user_id: string
          role: string
          invited_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          role?: string
          invited_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          role?: string
          invited_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'project_members_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'project_members_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      issue_sequences: {
        Row: {
          project_id: string
          last_number: number
        }
        Insert: {
          project_id: string
          last_number?: number
        }
        Update: {
          project_id?: string
          last_number?: number
        }
        Relationships: [
          {
            foreignKeyName: 'issue_sequences_project_id_fkey'
            columns: ['project_id']
            isOneToOne: true
            referencedRelation: 'projects'
            referencedColumns: ['id']
          }
        ]
      }
      sprints: {
        Row: {
          id: string
          project_id: string
          name: string
          goal: string | null
          start_date: string | null
          end_date: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          goal?: string | null
          start_date?: string | null
          end_date?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          goal?: string | null
          start_date?: string | null
          end_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sprints_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          }
        ]
      }
      epics: {
        Row: {
          id: string
          project_id: string
          name: string
          color: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          color?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          color?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'epics_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          }
        ]
      }
      project_statuses: {
        Row: {
          id: string
          project_id: string
          name: string
          color: string | null
          position: number
          requires_pause_reason: boolean
          is_completed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          color?: string | null
          position?: number
          requires_pause_reason?: boolean
          is_completed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          color?: string | null
          position?: number
          requires_pause_reason?: boolean
          is_completed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'project_statuses_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          }
        ]
      }
      project_issue_types: {
        Row: {
          id: string
          project_id: string
          name: string
          color: string | null
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          color?: string | null
          position?: number
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          color?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: 'project_issue_types_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          }
        ]
      }
      project_labels: {
        Row: {
          id: string
          project_id: string
          name: string
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          color?: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          color?: string
        }
        Relationships: [
          {
            foreignKeyName: 'project_labels_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          }
        ]
      }
      issue_labels: {
        Row: {
          issue_id: string
          label_id: string
        }
        Insert: {
          issue_id: string
          label_id: string
        }
        Update: {
          issue_id?: string
          label_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'issue_labels_issue_id_fkey'
            columns: ['issue_id']
            isOneToOne: false
            referencedRelation: 'issues'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'issue_labels_label_id_fkey'
            columns: ['label_id']
            isOneToOne: false
            referencedRelation: 'project_labels'
            referencedColumns: ['id']
          }
        ]
      }
      issues: {
        Row: {
          id: string
          project_id: string
          key: string
          title: string
          description: string | null
          status: string
          priority: string
          type: string
          assignee_id: string | null
          reporter_id: string
          position: number
          due_date: string | null
          start_date: string | null
          sprint_id: string | null
          epic_id: string | null
          slack_thread: string | null
          pause_reason: string | null
          resolved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          key?: string
          title: string
          description?: string | null
          status?: string
          priority?: string
          type?: string
          assignee_id?: string | null
          reporter_id: string
          position?: number
          due_date?: string | null
          start_date?: string | null
          sprint_id?: string | null
          epic_id?: string | null
          slack_thread?: string | null
          pause_reason?: string | null
          resolved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          key?: string
          title?: string
          description?: string | null
          status?: string
          priority?: string
          type?: string
          assignee_id?: string | null
          reporter_id?: string
          position?: number
          due_date?: string | null
          start_date?: string | null
          sprint_id?: string | null
          epic_id?: string | null
          slack_thread?: string | null
          pause_reason?: string | null
          resolved_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'issues_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'issues_assignee_id_fkey'
            columns: ['assignee_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'issues_reporter_id_fkey'
            columns: ['reporter_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'issues_sprint_id_fkey'
            columns: ['sprint_id']
            isOneToOne: false
            referencedRelation: 'sprints'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'issues_epic_id_fkey'
            columns: ['epic_id']
            isOneToOne: false
            referencedRelation: 'epics'
            referencedColumns: ['id']
          }
        ]
      }
      comments: {
        Row: {
          id: string
          issue_id: string
          author_id: string
          content: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          issue_id: string
          author_id: string
          content: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          issue_id?: string
          author_id?: string
          content?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'comments_issue_id_fkey'
            columns: ['issue_id']
            isOneToOne: false
            referencedRelation: 'issues'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comments_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      pending_invitations: {
        Row: {
          id: string
          project_id: string
          email: string
          role: string
          token: string
          invited_by: string
          created_at: string
          expires_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          email: string
          role?: string
          token?: string
          invited_by: string
          created_at?: string
          expires_at?: string
          accepted_at?: string | null
        }
        Update: {
          id?: string
          accepted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'pending_invitations_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pending_invitations_invited_by_fkey'
            columns: ['invited_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      attachments: {
        Row: {
          id: string
          issue_id: string | null
          comment_id: string | null
          uploaded_by: string
          file_name: string
          file_path: string
          file_size: number
          mime_type: string
          created_at: string
        }
        Insert: {
          id?: string
          issue_id?: string | null
          comment_id?: string | null
          uploaded_by: string
          file_name: string
          file_path: string
          file_size: number
          mime_type: string
          created_at?: string
        }
        Update: {
          id?: string
          issue_id?: string | null
          comment_id?: string | null
          uploaded_by?: string
          file_name?: string
          file_path?: string
          file_size?: number
          mime_type?: string
        }
        Relationships: [
          {
            foreignKeyName: 'attachments_issue_id_fkey'
            columns: ['issue_id']
            isOneToOne: false
            referencedRelation: 'issues'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'attachments_comment_id_fkey'
            columns: ['comment_id']
            isOneToOne: false
            referencedRelation: 'comments'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_project_ids: {
        Args: Record<string, never>
        Returns: string[]
      }
      get_user_role_in_project: {
        Args: { p_project_id: string }
        Returns: string
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
