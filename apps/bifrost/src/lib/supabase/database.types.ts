export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      companies: {
        Row: {
          company_id: number
          company_image: string | null
          company_name: string
          created_at: string | null
          description: string | null
          org_number: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: number
          company_image?: string | null
          company_name: string
          created_at?: string | null
          description?: string | null
          org_number?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: number
          company_image?: string | null
          company_name?: string
          created_at?: string | null
          description?: string | null
          org_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_company_image_fkey"
            columns: ["company_image"]
            isOneToOne: false
            referencedRelation: "company_images"
            referencedColumns: ["id"]
          },
        ]
      }
      event_organizers: {
        Row: {
          created_at: string | null
          event_id: number
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: number
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: number
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_event_organizers_event"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "fk_event_organizers_event"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "published_events_with_participation_count"
            referencedColumns: ["event_id"]
          },
        ]
      }
      events: {
        Row: {
          age_restrictions: string | null
          company_id: number
          created_at: string | null
          description: string | null
          event_id: number
          event_start: string
          external_url: string | null
          food: string
          language: string
          location: string
          participants_limit: number
          published: boolean
          registration_opens: string
          teaser: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          age_restrictions?: string | null
          company_id: number
          created_at?: string | null
          description?: string | null
          event_id?: number
          event_start: string
          external_url?: string | null
          food: string
          language?: string
          location: string
          participants_limit: number
          published?: boolean
          registration_opens: string
          teaser?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          age_restrictions?: string | null
          company_id?: number
          created_at?: string | null
          description?: string | null
          event_id?: number
          event_start?: string
          external_url?: string | null
          food?: string
          language?: string
          location?: string
          participants_limit?: number
          published?: boolean
          registration_opens?: string
          teaser?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_events_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "fk_events_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_images"
            referencedColumns: ["company_id"]
          },
        ]
      }
      job_listing_contacts: {
        Row: {
          contact_id: number
          created_at: string | null
          email: string | null
          listing_id: number
          name: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          contact_id?: number
          created_at?: string | null
          email?: string | null
          listing_id: number
          name: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          contact_id?: number
          created_at?: string | null
          email?: string | null
          listing_id?: number
          name?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_job_listing_contacts_listing"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "job_listings"
            referencedColumns: ["listing_id"]
          },
        ]
      }
      job_listings: {
        Row: {
          application_url: string
          company_id: number
          created_at: string | null
          deadline: string
          description: string
          listing_id: number
          published: boolean
          teaser: string
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          application_url: string
          company_id: number
          created_at?: string | null
          deadline: string
          description: string
          listing_id?: number
          published?: boolean
          teaser: string
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          application_url?: string
          company_id?: number
          created_at?: string | null
          deadline?: string
          description?: string
          listing_id?: number
          published?: boolean
          teaser?: string
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_job_listings_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "fk_job_listings_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_images"
            referencedColumns: ["company_id"]
          },
        ]
      }
      organization: {
        Row: {
          created_at: string | null
          group_name: string
          organization_id: number
          position: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          group_name: string
          organization_id?: number
          position: string
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string | null
          group_name?: string
          organization_id?: number
          position?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pages: {
        Row: {
          content: string
          created_at: string | null
          page_id: number
          published: boolean
          title: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          page_id?: number
          published?: boolean
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          page_id?: number
          published?: boolean
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      points: {
        Row: {
          awarded_time: string | null
          created_at: string | null
          point_id: number
          reason: string
          severity: number
          user_id: string
        }
        Insert: {
          awarded_time?: string | null
          created_at?: string | null
          point_id?: number
          reason: string
          severity: number
          user_id?: string
        }
        Update: {
          awarded_time?: string | null
          created_at?: string | null
          point_id?: number
          reason?: string
          severity?: number
          user_id?: string
        }
        Relationships: []
      }
      registrations: {
        Row: {
          attendance_status: string | null
          attendance_time: string | null
          created_at: string | null
          event_id: number
          note: string | null
          registration_id: number
          registration_time: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attendance_status?: string | null
          attendance_time?: string | null
          created_at?: string | null
          event_id: number
          note?: string | null
          registration_id?: number
          registration_time?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          attendance_status?: string | null
          attendance_time?: string | null
          created_at?: string | null
          event_id?: number
          note?: string | null
          registration_id?: number
          registration_time?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_registrations_event"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "fk_registrations_event"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "published_events_with_participation_count"
            referencedColumns: ["event_id"]
          },
        ]
      }
      resources: {
        Row: {
          content: string
          created_at: string | null
          excerpt: string | null
          published: boolean
          resource_id: number
          tag: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          excerpt?: string | null
          published?: boolean
          resource_id?: number
          tag?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          excerpt?: string | null
          published?: boolean
          resource_id?: number
          tag?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      students: {
        Row: {
          created_at: string | null
          degree: string
          semester: number
          study_program: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          degree: string
          semester: number
          study_program: string
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string | null
          degree?: string
          semester?: number
          study_program?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      company_images: {
        Row: {
          company_id: number | null
          id: string | null
          name: string | null
        }
        Relationships: []
      }
      published_events_with_participation_count: {
        Row: {
          age_restrictions: string | null
          company_id: number | null
          created_at: string | null
          description: string | null
          event_id: number | null
          event_start: string | null
          external_url: string | null
          food: string | null
          language: string | null
          location: string | null
          participants: number | null
          participants_limit: number | null
          published: boolean | null
          registration_opens: string | null
          teaser: string | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_events_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "fk_events_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_images"
            referencedColumns: ["company_id"]
          },
        ]
      }
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
