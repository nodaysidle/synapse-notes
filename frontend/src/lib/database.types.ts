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
      workspaces: {
        Row: {
          id: string
          name: string
          invite_code: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          invite_code?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          invite_code?: string | null
          created_at?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          display_name: string
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          display_name: string
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          display_name?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
      }
      notes: {
        Row: {
          id: string
          workspace_id: string
          created_by: string
          title: string
          content: string | null
          transcript: string | null
          audio_url: string | null
          image_url: string | null
          duration: number | null
          embedding: number[] | null
          embedding_status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          created_by: string
          title: string
          content?: string | null
          transcript?: string | null
          audio_url?: string | null
          image_url?: string | null
          duration?: number | null
          embedding?: number[] | null
          embedding_status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          created_by?: string
          title?: string
          content?: string | null
          transcript?: string | null
          audio_url?: string | null
          image_url?: string | null
          duration?: number | null
          embedding?: number[] | null
          embedding_status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
      }
      tags: {
        Row: {
          id: string
          name: string
          workspace_id: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          workspace_id: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          workspace_id?: string
          created_at?: string
        }
        Relationships: []
      }
      note_tags: {
        Row: {
          note_id: string
          tag_id: string
        }
        Insert: {
          note_id: string
          tag_id: string
        }
        Update: {
          note_id?: string
          tag_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      leave_workspace: {
        Args: { workspace_id_param: string }
        Returns: boolean
      }
      get_my_workspace_ids: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      get_workspace_by_invite_code: {
        Args: { invite_code_param: string }
        Returns: {
          id: string
          name: string
          invite_code: string
          created_at: string
        }[]
      }
      create_workspace_with_member: {
        Args: {
          workspace_name: string
          invite_code_param: string
          display_name_param: string
        }
        Returns: {
          id: string
          name: string
          invite_code: string
          created_at: string
        }[]
      }
      match_notes: {
        Args: {
          query_embedding: number[]
          match_workspace_id: string
          match_count?: number
          exclude_note_id?: string | null
        }
        Returns: {
          id: string
          title: string
          transcript: string
          image_url: string | null
          created_at: string
          similarity: number
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

// Convenience types
export type Workspace = Database['public']['Tables']['workspaces']['Row']
export type WorkspaceMember = Database['public']['Tables']['workspace_members']['Row']
export type Note = Database['public']['Tables']['notes']['Row']
export type Tag = Database['public']['Tables']['tags']['Row']
