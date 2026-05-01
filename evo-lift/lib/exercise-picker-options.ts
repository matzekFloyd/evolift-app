export type ExercisePickerOption = {
  id: string;
  label: string;
  slug: string;
};

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
