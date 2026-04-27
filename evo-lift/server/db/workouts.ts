import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type CreateWorkoutSessionInput = {
  userId: string;
  performedOn?: string;
  notes?: string | null;
};

type UpdateWorkoutSetInput = {
  id: string;
  reps?: number;
  weightKg?: number | null;
  isWarmup?: boolean;
  notes?: string | null;
};

export async function createWorkoutSession(
  client: SupabaseClient<Database>,
  input: CreateWorkoutSessionInput,
) {
  const payload: Database["public"]["Tables"]["workout_sessions"]["Insert"] = {
    user_id: input.userId,
    performed_on: input.performedOn,
    notes: input.notes,
  };

  const { data, error } = await client
    .from("workout_sessions")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create workout session: ${error.message}`);
  }

  return data;
}

export async function updateWorkoutSet(
  client: SupabaseClient<Database>,
  input: UpdateWorkoutSetInput,
) {
  const updatePayload: Database["public"]["Tables"]["workout_sets"]["Update"] =
    {};

  if (input.reps !== undefined) {
    updatePayload.reps = input.reps;
  }
  if (input.weightKg !== undefined) {
    updatePayload.weight_kg = input.weightKg;
  }
  if (input.isWarmup !== undefined) {
    updatePayload.is_warmup = input.isWarmup;
  }
  if (input.notes !== undefined) {
    updatePayload.notes = input.notes;
  }

  const { data, error } = await client
    .from("workout_sets")
    .update(updatePayload)
    .eq("id", input.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update workout set: ${error.message}`);
  }

  return data;
}
