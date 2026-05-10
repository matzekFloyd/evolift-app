import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type TemplateExerciseInput = {
  exerciseId: string;
  targetSets: number | null;
  targetReps: number | null;
  targetWeightKg: number | null;
  baseWeightKg: number | null;
  notes: string | null;
};

export type WorkoutTemplateListItem = {
  id: string;
  name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  exerciseCount: number;
};

export type WorkoutTemplateExerciseRow =
  Database["public"]["Tables"]["workout_template_exercises"]["Row"];

export type WorkoutTemplateWithExercises =
  Database["public"]["Tables"]["workout_templates"]["Row"] & {
    exercises: WorkoutTemplateExerciseRow[];
  };

function requireNonEmptyName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Please enter a template name.");
  }
  return trimmed;
}

export async function listTemplates(
  client: SupabaseClient<Database>,
): Promise<WorkoutTemplateListItem[]> {
  const { data, error } = await client
    .from("workout_templates")
    .select("id, name, notes, created_at, updated_at, workout_template_exercises(id)")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list templates: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    exerciseCount: row.workout_template_exercises?.length ?? 0,
  }));
}

export async function getTemplateById(
  client: SupabaseClient<Database>,
  templateId: string,
): Promise<WorkoutTemplateWithExercises | null> {
  const { data: template, error: templateError } = await client
    .from("workout_templates")
    .select("*")
    .eq("id", templateId)
    .maybeSingle();

  if (templateError) {
    throw new Error(`Failed to load template: ${templateError.message}`);
  }
  if (!template) {
    return null;
  }

  const { data: exercises, error: exercisesError } = await client
    .from("workout_template_exercises")
    .select("*")
    .eq("template_id", templateId)
    .order("position", { ascending: true });

  if (exercisesError) {
    throw new Error(`Failed to load template exercises: ${exercisesError.message}`);
  }

  return {
    ...template,
    exercises: exercises ?? [],
  };
}

export async function createTemplate(
  client: SupabaseClient<Database>,
  input: {
    userId: string;
    name: string;
    notes?: string | null;
    exercises: TemplateExerciseInput[];
  },
): Promise<WorkoutTemplateWithExercises> {
  const trimmedName = requireNonEmptyName(input.name);
  const notes = input.notes?.trim() ? input.notes.trim() : null;

  if (input.exercises.length === 0) {
    throw new Error("Add at least one exercise to the template.");
  }

  const { data: template, error: insertError } = await client
    .from("workout_templates")
    .insert({
      user_id: input.userId,
      name: trimmedName,
      notes,
    })
    .select()
    .single();

  if (insertError || !template) {
    throw new Error(`Failed to create template: ${insertError?.message ?? "unknown error"}`);
  }

  const exerciseRows: Database["public"]["Tables"]["workout_template_exercises"]["Insert"][] =
    input.exercises.map((row, index) => ({
      template_id: template.id,
      exercise_id: row.exerciseId,
      position: index + 1,
      target_sets: row.targetSets,
      target_reps: row.targetReps,
      target_weight_kg: row.targetWeightKg,
      base_weight_kg: row.baseWeightKg,
      notes: row.notes,
    }));

  const { error: exercisesError } = await client
    .from("workout_template_exercises")
    .insert(exerciseRows);

  if (exercisesError) {
    await client.from("workout_templates").delete().eq("id", template.id);
    throw new Error(`Failed to save template exercises: ${exercisesError.message}`);
  }

  const full = await getTemplateById(client, template.id);
  if (!full) {
    throw new Error("Template was created but could not be reloaded.");
  }
  return full;
}

export async function updateTemplate(
  client: SupabaseClient<Database>,
  templateId: string,
  input: {
    name: string;
    notes?: string | null;
    exercises: TemplateExerciseInput[];
  },
): Promise<WorkoutTemplateWithExercises> {
  const trimmedName = requireNonEmptyName(input.name);
  const notes = input.notes?.trim() ? input.notes.trim() : null;

  if (input.exercises.length === 0) {
    throw new Error("Add at least one exercise to the template.");
  }

  const { error: updateError } = await client
    .from("workout_templates")
    .update({
      name: trimmedName,
      notes,
    })
    .eq("id", templateId);

  if (updateError) {
    throw new Error(`Failed to update template: ${updateError.message}`);
  }

  const { error: deleteError } = await client
    .from("workout_template_exercises")
    .delete()
    .eq("template_id", templateId);

  if (deleteError) {
    throw new Error(`Failed to update template exercises: ${deleteError.message}`);
  }

  const exerciseRows: Database["public"]["Tables"]["workout_template_exercises"]["Insert"][] =
    input.exercises.map((row, index) => ({
      template_id: templateId,
      exercise_id: row.exerciseId,
      position: index + 1,
      target_sets: row.targetSets,
      target_reps: row.targetReps,
      target_weight_kg: row.targetWeightKg,
      base_weight_kg: row.baseWeightKg,
      notes: row.notes,
    }));

  const { error: insertError } = await client
    .from("workout_template_exercises")
    .insert(exerciseRows);

  if (insertError) {
    throw new Error(`Failed to save template exercises: ${insertError.message}`);
  }

  const full = await getTemplateById(client, templateId);
  if (!full) {
    throw new Error("Template was updated but could not be reloaded.");
  }
  return full;
}

export async function deleteTemplate(
  client: SupabaseClient<Database>,
  templateId: string,
): Promise<void> {
  const { error } = await client.from("workout_templates").delete().eq("id", templateId);
  if (error) {
    throw new Error(`Failed to delete template: ${error.message}`);
  }
}

export async function instantiateTemplate(
  client: SupabaseClient<Database>,
  input: {
    templateId: string;
    performedOn: string;
    notes?: string | null;
  },
): Promise<string> {
  const { data, error } = await client.rpc("instantiate_workout_template", {
    p_template_id: input.templateId,
    p_performed_on: input.performedOn,
    p_notes: input.notes ?? null,
  });

  if (error) {
    throw new Error(`Failed to start session from template: ${error.message}`);
  }
  if (!data || typeof data !== "string") {
    throw new Error("Failed to start session from template: no session id returned.");
  }
  return data;
}
