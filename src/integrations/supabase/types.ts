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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attendance_records: {
        Row: {
          created_at: string
          id: string
          scanned_at: string
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          scanned_at?: string
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          scanned_at?: string
          session_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          auto_close_at: string | null
          class_id: string
          created_at: string
          ended_at: string | null
          id: string
          is_active: boolean
          late_after_minutes: number
          session_code: string
          started_at: string
          teacher_id: string
          title: string | null
        }
        Insert: {
          auto_close_at?: string | null
          class_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          late_after_minutes?: number
          session_code?: string
          started_at?: string
          teacher_id: string
          title?: string | null
        }
        Update: {
          auto_close_at?: string | null
          class_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          late_after_minutes?: number
          session_code?: string
          started_at?: string
          teacher_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          code: string | null
          course_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          teacher_id: string
          updated_at: string
          year_level: Database["public"]["Enums"]["year_level"] | null
        }
        Insert: {
          code?: string | null
          course_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          teacher_id: string
          updated_at?: string
          year_level?: Database["public"]["Enums"]["year_level"] | null
        }
        Update: {
          code?: string | null
          course_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          teacher_id?: string
          updated_at?: string
          year_level?: Database["public"]["Enums"]["year_level"] | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      enrollment_requests: {
        Row: {
          class_id: string
          created_at: string
          id: string
          proof_path: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["enrollment_request_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          proof_path: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["enrollment_request_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          proof_path?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["enrollment_request_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_requests_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          class_id: string
          created_at: string
          full_name: string
          id: string
          student_id: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          full_name: string
          id?: string
          student_id?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          full_name?: string
          id?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          deactivated_at: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deactivated_at?: string | null
          email?: string | null
          full_name?: string
          id: string
          is_active?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deactivated_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          course: string
          course_id: string | null
          created_at: string
          full_name: string
          id: string
          qr_token: string
          section: string
          updated_at: string
          user_id: string | null
          year_level: string
        }
        Insert: {
          course: string
          course_id?: string | null
          created_at?: string
          full_name: string
          id?: string
          qr_token?: string
          section: string
          updated_at?: string
          user_id?: string | null
          year_level: string
        }
        Update: {
          course?: string
          course_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          qr_token?: string
          section?: string
          updated_at?: string
          user_id?: string | null
          year_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_assignments: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          id: string
          teacher_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          teacher_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_assign_teacher_role: {
        Args: { _user_id: string }
        Returns: undefined
      }
      admin_list_teacher_assignments: {
        Args: never
        Returns: {
          assignments: Json
          email: string
          full_name: string
          teacher_id: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_class_teacher: { Args: { _class_id: string }; Returns: boolean }
      is_enrolled_in_class: { Args: { _class_id: string }; Returns: boolean }
      is_session_teacher: { Args: { _session_id: string }; Returns: boolean }
      is_student_owner: { Args: { _student_id: string }; Returns: boolean }
      is_teacher_assigned_to_course: {
        Args: { _course_id: string; _teacher_id: string }
        Returns: boolean
      }
      list_classes_for_enrollment: {
        Args: never
        Returns: {
          code: string
          created_at: string
          description: string
          id: string
          name: string
        }[]
      }
      student_check_in: {
        Args: { _session_code: string }
        Returns: {
          class_name: string
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
        }[]
      }
      student_enroll_in_class: { Args: { _class_id: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "teacher" | "student"
      attendance_status: "present" | "late" | "absent"
      enrollment_request_status: "pending" | "approved" | "rejected"
      year_level:
        | "first_year"
        | "second_year"
        | "third_year"
        | "fourth_year"
        | "graduate"
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
    Enums: {
      app_role: ["admin", "teacher", "student"],
      attendance_status: ["present", "late", "absent"],
      enrollment_request_status: ["pending", "approved", "rejected"],
      year_level: [
        "first_year",
        "second_year",
        "third_year",
        "fourth_year",
        "graduate",
      ],
    },
  },
} as const
