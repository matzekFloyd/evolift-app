import { toExerciseBadge } from "@/lib/exercise-badge";

export type ExercisePickerOption = {
  id: string;
  label: string;
  slug: string;
};

/** Case-insensitive match on display name, slug, or badge text (for picker search). */
export function filterExercisePickerOptionsByQuery(
  options: ExercisePickerOption[],
  query: string,
): ExercisePickerOption[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return options;
  }
  return options.filter((option) => {
    const label = option.label.toLowerCase();
    const slug = option.slug.toLowerCase();
    const badge = toExerciseBadge(option.slug).toLowerCase();
    return label.includes(q) || slug.includes(q) || badge.includes(q);
  });
}

/**
 * Hides exercises from pickers unless the row already selected that exercise
 * (e.g. draft or existing session line).
 */
export function exerciseOptionsForPicker(
  all: ExercisePickerOption[],
  hiddenIds: Set<string>,
  selectedExerciseId?: string,
): ExercisePickerOption[] {
  if (!selectedExerciseId) {
    return all.filter((option) => !hiddenIds.has(option.id));
  }
  return all.filter(
    (option) => !hiddenIds.has(option.id) || option.id === selectedExerciseId,
  );
}
