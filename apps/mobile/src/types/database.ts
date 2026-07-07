export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          alert_type: Database["public"]["Enums"]["alert_type"]
          caregiver_id: string
          created_at: string
          event_id: string | null
          id: string
          is_read: boolean
          patient_id: string
        }
        Insert: {
          alert_type: Database["public"]["Enums"]["alert_type"]
          caregiver_id: string
          created_at?: string
          event_id?: string | null
          id?: string
          is_read?: boolean
          patient_id: string
        }
        Update: {
          alert_type?: Database["public"]["Enums"]["alert_type"]
          caregiver_id?: string
          created_at?: string
          event_id?: string | null
          id?: string
          is_read?: boolean
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "medication_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_events: {
        Row: {
          created_at: string
          id: string
          medication_id: string
          notes: string | null
          notified_at: string | null
          patient_id: string
          schedule_id: string
          scheduled_time: string
          snooze_count: number
          status: Database["public"]["Enums"]["event_status"]
          taken_time: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          medication_id: string
          notes?: string | null
          notified_at?: string | null
          patient_id: string
          schedule_id: string
          scheduled_time: string
          snooze_count?: number
          status?: Database["public"]["Enums"]["event_status"]
          taken_time?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          medication_id?: string
          notes?: string | null
          notified_at?: string | null
          patient_id?: string
          schedule_id?: string
          scheduled_time?: string
          snooze_count?: number
          status?: Database["public"]["Enums"]["event_status"]
          taken_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medication_events_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_events_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_events_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "medication_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_schedules: {
        Row: {
          created_at: string
          days_of_week: number[] | null
          end_date: string | null
          frequency_type: Database["public"]["Enums"]["frequency_type"]
          id: string
          is_active: boolean
          medication_id: string
          start_date: string
          times_of_day: string[]
        }
        Insert: {
          created_at?: string
          days_of_week?: number[] | null
          end_date?: string | null
          frequency_type: Database["public"]["Enums"]["frequency_type"]
          id?: string
          is_active?: boolean
          medication_id: string
          start_date?: string
          times_of_day: string[]
        }
        Update: {
          created_at?: string
          days_of_week?: number[] | null
          end_date?: string | null
          frequency_type?: Database["public"]["Enums"]["frequency_type"]
          id?: string
          is_active?: boolean
          medication_id?: string
          start_date?: string
          times_of_day?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "medication_schedules_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          created_at: string
          created_by: string | null
          dosage: string
          id: string
          instructions: string | null
          is_active: boolean
          name: string
          patient_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dosage: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          name: string
          patient_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dosage?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          name?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_caregiver_relationships: {
        Row: {
          caregiver_id: string
          created_at: string
          id: string
          patient_id: string
          status: Database["public"]["Enums"]["relationship_status"]
        }
        Insert: {
          caregiver_id: string
          created_at?: string
          id?: string
          patient_id: string
          status?: Database["public"]["Enums"]["relationship_status"]
        }
        Update: {
          caregiver_id?: string
          created_at?: string
          id?: string
          patient_id?: string
          status?: Database["public"]["Enums"]["relationship_status"]
        }
        Relationships: [
          {
            foreignKeyName: "patient_caregiver_relationships_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_caregiver_relationships_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: Database["public"]["Enums"]["push_platform"]
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: Database["public"]["Enums"]["push_platform"]
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: Database["public"]["Enums"]["push_platform"]
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          language: string
          name: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          timezone: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          language?: string
          name: string
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          timezone?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          language?: string
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          timezone?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_caregiver_for: { Args: { patient: string }; Returns: boolean }
      snooze_event: {
        Args: { p_event_id: string }
        Returns: {
          created_at: string
          id: string
          medication_id: string
          notes: string | null
          notified_at: string | null
          patient_id: string
          schedule_id: string
          scheduled_time: string
          snooze_count: number
          status: Database["public"]["Enums"]["event_status"]
          taken_time: string | null
        }
        SetofOptions: {
          from: "*"
          to: "medication_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      alert_type:
        | "missed"
        | "snoozed_limit"
        | "low_adherence"
        | "new_medication"
      event_status: "pending" | "taken" | "snoozed" | "missed"
      frequency_type:
        | "daily"
        | "twice_daily"
        | "three_times_daily"
        | "weekly"
        | "custom"
      push_platform: "ios" | "android"
      relationship_status: "pending" | "active" | "revoked"
      user_role: "patient" | "caregiver"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      alert_type: [
        "missed",
        "snoozed_limit",
        "low_adherence",
        "new_medication",
      ],
      event_status: ["pending", "taken", "snoozed", "missed"],
      frequency_type: [
        "daily",
        "twice_daily",
        "three_times_daily",
        "weekly",
        "custom",
      ],
      push_platform: ["ios", "android"],
      relationship_status: ["pending", "active", "revoked"],
      user_role: ["patient", "caregiver"],
    },
  },
} as const

