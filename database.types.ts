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
      attendees: {
        Row: {
          created_at: string
          dietary_restrictions: string | null
          event: number
          id: string
          status: string | null
          student: string
        }
        Insert: {
          created_at?: string
          dietary_restrictions?: string | null
          event: number
          id?: string
          status?: string | null
          student: string
        }
        Update: {
          created_at?: string
          dietary_restrictions?: string | null
          event?: number
          id?: string
          status?: string | null
          student?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendees_event_fkey"
            columns: ["event"]
            isOneToOne: false
            referencedRelation: "event"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendees_student_fkey"
            columns: ["student"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      company: {
        Row: {
          created_at: string
          description: string | null
          id: string
          logo: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          logo?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          logo?: string
          name?: string
        }
        Relationships: []
      }
      contact_info: {
        Row: {
          email: string | null
          id: string
          name: string | null
          phone_number: number | null
        }
        Insert: {
          email?: string | null
          id?: string
          name?: string | null
          phone_number?: number | null
        }
        Update: {
          email?: string | null
          id?: string
          name?: string | null
          phone_number?: number | null
        }
        Relationships: []
      }
      event: {
        Row: {
          age_restriction: string | null
          attendees: string | null
          created_at: string
          description: string | null
          event_date: string
          event_type: string
          external_url: string | null
          food: string | null
          hosting_compant: string | null
          id: number
          location: string | null
          organizers: number | null
          participation_limit: number
          registration_date: string
          teaser: string | null
          title: string
        }
        Insert: {
          age_restriction?: string | null
          attendees?: string | null
          created_at?: string
          description?: string | null
          event_date?: string
          event_type: string
          external_url?: string | null
          food?: string | null
          hosting_compant?: string | null
          id?: number
          location?: string | null
          organizers?: number | null
          participation_limit?: number
          registration_date?: string
          teaser?: string | null
          title: string
        }
        Update: {
          age_restriction?: string | null
          attendees?: string | null
          created_at?: string
          description?: string | null
          event_date?: string
          event_type?: string
          external_url?: string | null
          food?: string | null
          hosting_compant?: string | null
          id?: number
          location?: string | null
          organizers?: number | null
          participation_limit?: number
          registration_date?: string
          teaser?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_fkey"
            columns: ["attendees"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_hosting_compant_fkey"
            columns: ["hosting_compant"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_organizers_fkey"
            columns: ["organizers"]
            isOneToOne: false
            referencedRelation: "event_organizers"
            referencedColumns: ["id"]
          },
        ]
      }
      event_organizers: {
        Row: {
          created_at: string
          event: number
          id: number
          navet_member: string
          type: string | null
        }
        Insert: {
          created_at?: string
          event: number
          id?: number
          navet_member: string
          type?: string | null
        }
        Update: {
          created_at?: string
          event?: number
          id?: number
          navet_member?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_organizers_event_fkey"
            columns: ["event"]
            isOneToOne: true
            referencedRelation: "event"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_organizers_navet_member_fkey"
            columns: ["navet_member"]
            isOneToOne: false
            referencedRelation: "internal_member"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_member: {
        Row: {
          created_at: string
          group: string | null
          id: string
          member_image: string | null
          navet_email: string
          permissions: number | null
          position: string
        }
        Insert: {
          created_at?: string
          group?: string | null
          id?: string
          member_image?: string | null
          navet_email: string
          permissions?: number | null
          position: string
        }
        Update: {
          created_at?: string
          group?: string | null
          id?: string
          member_image?: string | null
          navet_email?: string
          permissions?: number | null
          position?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_id_fkey3"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_permissions_fkey"
            columns: ["permissions"]
            isOneToOne: false
            referencedRelation: "member_permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      job_listing: {
        Row: {
          application_url: string | null
          company: string
          contact_person: string | null
          created_at: string
          deadline: string
          description: string | null
          id: string
          job_type: string | null
          teaser: string | null
        }
        Insert: {
          application_url?: string | null
          company: string
          contact_person?: string | null
          created_at?: string
          deadline: string
          description?: string | null
          id?: string
          job_type?: string | null
          teaser?: string | null
        }
        Update: {
          application_url?: string | null
          company?: string
          contact_person?: string | null
          created_at?: string
          deadline?: string
          description?: string | null
          id?: string
          job_type?: string | null
          teaser?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_listing_company_fkey"
            columns: ["company"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_listing_contact_person_fkey"
            columns: ["contact_person"]
            isOneToOne: false
            referencedRelation: "contact_info"
            referencedColumns: ["id"]
          },
        ]
      }
      member_permissions: {
        Row: {
          id: number
          member: string
          permission: string
        }
        Insert: {
          id?: number
          member: string
          permission: string
        }
        Update: {
          id?: number
          member?: string
          permission?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_permissions_member_fkey"
            columns: ["member"]
            isOneToOne: false
            referencedRelation: "internal_member"
            referencedColumns: ["id"]
          },
        ]
      }
      point: {
        Row: {
          at_event: number | null
          created_at: string
          id: string
          reason: string | null
          severity: number
        }
        Insert: {
          at_event?: number | null
          created_at?: string
          id: string
          reason?: string | null
          severity?: number
        }
        Update: {
          at_event?: number | null
          created_at?: string
          id?: string
          reason?: string | null
          severity?: number
        }
        Relationships: [
          {
            foreignKeyName: "point_at_event_fkey"
            columns: ["at_event"]
            isOneToOne: false
            referencedRelation: "event"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      student: {
        Row: {
          created_at: string
          id: string
          prefered_language: string
          study_programme: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          prefered_language?: string
          study_programme: string
          year?: number
        }
        Update: {
          created_at?: string
          id?: string
          prefered_language?: string
          study_programme?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_id_fkey1"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      user: {
        Row: {
          created_at: string
          firstname: string
          id: string
          lastname: string
        }
        Insert: {
          created_at?: string
          firstname: string
          id: string
          lastname: string
        }
        Update: {
          created_at?: string
          firstname?: string
          id?: string
          lastname?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
