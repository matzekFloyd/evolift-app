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
      workout_sessions: {
        Row: {
          id: string;
          user_id: string;
          performed_on: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          performed_on?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          performed_on?: string;
          notes?: string | null;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      language_code: LanguageCode;
    };
    CompositeTypes: Record<string, never>;
  };
};
