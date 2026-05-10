export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type LanguageCode = "en" | "de";

export type Database = {
  public: {
    Tables: {
      app_users: {
        Row: {
          id: string;
          display_name: string | null;
          preferred_lang_code: LanguageCode;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          preferred_lang_code?: LanguageCode;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          preferred_lang_code?: LanguageCode;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      exercises: {
        Row: {
          id: string;
          slug: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      exercise_translations: {
        Row: {
          exercise_id: string;
          lang_code: LanguageCode;
          name: string;
          created_at: string;
        };
        Insert: {
          exercise_id: string;
          lang_code: LanguageCode;
          name: string;
          created_at?: string;
        };
        Update: {
          exercise_id?: string;
          lang_code?: LanguageCode;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      user_hidden_exercises: {
        Row: {
          user_id: string;
          exercise_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          exercise_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          exercise_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      user_profile_metrics: {
        Row: {
          user_id: string;
          bodyweight_kg: number | null;
          height_cm: number | null;
          birth_year: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          bodyweight_kg?: number | null;
          height_cm?: number | null;
          birth_year?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          bodyweight_kg?: number | null;
          height_cm?: number | null;
          birth_year?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workout_sessions: {
        Row: {
          id: string;
          user_id: string;
          performed_on: string;
          notes: string | null;
          source_template_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          performed_on?: string;
          notes?: string | null;
          source_template_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          performed_on?: string;
          notes?: string | null;
          source_template_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workout_session_exercises: {
        Row: {
          id: string;
          session_id: string;
          exercise_id: string;
          position: number;
          base_weight_kg: number | null;
          target_sets: number | null;
          target_reps: number | null;
          target_weight_kg: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          exercise_id: string;
          position: number;
          base_weight_kg?: number | null;
          target_sets?: number | null;
          target_reps?: number | null;
          target_weight_kg?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          exercise_id?: string;
          position?: number;
          base_weight_kg?: number | null;
          target_sets?: number | null;
          target_reps?: number | null;
          target_weight_kg?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      workout_sets: {
        Row: {
          id: string;
          session_exercise_id: string;
          set_number: number;
          reps: number;
          weight_kg: number | null;
          is_warmup: boolean;
          performed_at: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_exercise_id: string;
          set_number: number;
          reps: number;
          weight_kg?: number | null;
          is_warmup?: boolean;
          performed_at?: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_exercise_id?: string;
          set_number?: number;
          reps?: number;
          weight_kg?: number | null;
          is_warmup?: boolean;
          performed_at?: string;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      user_exercise_defaults: {
        Row: {
          user_id: string;
          exercise_id: string;
          default_base_weight_kg: number | null;
          default_target_sets: number | null;
          default_target_reps: number | null;
          default_target_weight_kg: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          exercise_id: string;
          default_base_weight_kg?: number | null;
          default_target_sets?: number | null;
          default_target_reps?: number | null;
          default_target_weight_kg?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          exercise_id?: string;
          default_base_weight_kg?: number | null;
          default_target_sets?: number | null;
          default_target_reps?: number | null;
          default_target_weight_kg?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workout_templates: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workout_template_exercises: {
        Row: {
          id: string;
          template_id: string;
          exercise_id: string;
          position: number;
          target_sets: number | null;
          target_reps: number | null;
          target_weight_kg: number | null;
          base_weight_kg: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          exercise_id: string;
          position: number;
          target_sets?: number | null;
          target_reps?: number | null;
          target_weight_kg?: number | null;
          base_weight_kg?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          template_id?: string;
          exercise_id?: string;
          position?: number;
          target_sets?: number | null;
          target_reps?: number | null;
          target_weight_kg?: number | null;
          base_weight_kg?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      instantiate_workout_template: {
        Args: {
          p_notes?: string | null;
          p_performed_on: string;
          p_template_id: string;
        };
        Returns: string;
      };
    };
    Enums: {
      language_code: LanguageCode;
    };
    CompositeTypes: Record<string, never>;
  };
};
