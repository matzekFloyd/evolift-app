import type { Database } from "@/lib/supabase/database.types";

export type ExerciseDraftRow = {
  rowId: string;
  exerciseId: string;
  baseWeightKg: string;
  targetSets: string;
  targetReps: string;
  targetWeightKg: string;
  notes: string;
};

export type ExerciseDefaultsRow = Database["public"]["Tables"]["user_exercise_defaults"]["Row"];

let nextExerciseRowId = 1;

export function createEmptyExerciseRow(): ExerciseDraftRow {
  return {
    rowId: `exercise-row-${nextExerciseRowId++}`,
    exerciseId: "",
    baseWeightKg: "",
    targetSets: "",
    targetReps: "",
    targetWeightKg: "",
    notes: "",
  };
}

type TemplateExerciseLike = {
  exercise_id: string;
  position: number;
  base_weight_kg: number | null;
  target_sets: number | null;
  target_reps: number | null;
  target_weight_kg: number | null;
  notes: string | null;
};

/** Build draft rows from saved template lines (ordered by `position`). */
export function exerciseDraftRowsFromTemplateLines(
  lines: TemplateExerciseLike[],
): ExerciseDraftRow[] {
  const sorted = [...lines].sort((a, b) => a.position - b.position);
  return sorted.map((line) => ({
    ...createEmptyExerciseRow(),
    exerciseId: line.exercise_id,
    baseWeightKg:
      line.base_weight_kg != null && Number.isFinite(Number(line.base_weight_kg))
        ? String(line.base_weight_kg)
        : "",
    targetSets:
      line.target_sets != null && line.target_sets > 0 ? String(line.target_sets) : "",
    targetReps:
      line.target_reps != null && line.target_reps > 0 ? String(line.target_reps) : "",
    targetWeightKg:
      line.target_weight_kg != null && Number.isFinite(Number(line.target_weight_kg))
        ? String(line.target_weight_kg)
        : "",
    notes: line.notes?.trim() ? line.notes : "",
  }));
}
