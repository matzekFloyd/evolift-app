"use client";

import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Dumbbell,
  Eraser,
  ListChecks,
  NotebookPen,
  Plus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ActionButton } from "@/app/components/action-button";
import { ExerciseSearchSelect } from "@/app/components/exercise-search-select";
import { InfoPopover } from "@/app/components/info-popover";
import { NotesTextareaField } from "@/app/components/notes-textarea-field";
import {
  createEmptyExerciseRow,
  type ExerciseDefaultsRow,
  type ExerciseDraftRow,
} from "@/lib/workout-exercise-draft";
import { toExerciseBadge } from "@/lib/exercise-badge";
import { exerciseOptionsForPicker } from "@/lib/exercise-picker-options";

export type WorkoutExerciseDraftListProps = {
  exerciseRows: ExerciseDraftRow[];
  setExerciseRows: React.Dispatch<React.SetStateAction<ExerciseDraftRow[]>>;
  exerciseOptions: Array<{ id: string; label: string; slug: string }>;
  hiddenExerciseIds: Set<string>;
  exerciseDefaultsById: Map<string, ExerciseDefaultsRow>;
  maxNotesLength?: number;
  onClearDraft?: () => void;
};

export function WorkoutExerciseDraftList({
  exerciseRows,
  setExerciseRows,
  exerciseOptions,
  hiddenExerciseIds,
  exerciseDefaultsById,
  maxNotesLength = 500,
  onClearDraft,
}: WorkoutExerciseDraftListProps) {
  const [expandedExerciseNotes, setExpandedExerciseNotes] = useState<Set<number>>(new Set());
  const [collapsedExercises, setCollapsedExercises] = useState<Set<string>>(new Set());
  const [isSmallPhone, setIsSmallPhone] = useState(false);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsSmallPhone(mediaQuery.matches);
    apply();
    const onChange = () => apply();
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (activeExerciseIndex >= exerciseRows.length) {
      // Clamp when a row is removed; keeps compact "one exercise" view aligned.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync UI index to shorter list
      setActiveExerciseIndex(Math.max(0, exerciseRows.length - 1));
    }
  }, [activeExerciseIndex, exerciseRows.length]);

  function addExerciseRow() {
    setExerciseRows((prev) => [...prev, createEmptyExerciseRow()]);
  }

  function removeExerciseRow(index: number) {
    const removedRowId = exerciseRows[index]?.rowId ?? null;
    setExerciseRows((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
    setExpandedExerciseNotes((prev) => {
      const next = new Set<number>();
      for (const currentIndex of prev) {
        if (currentIndex === index) {
          continue;
        }
        next.add(currentIndex > index ? currentIndex - 1 : currentIndex);
      }
      return next;
    });
    if (removedRowId) {
      setCollapsedExercises((prev) => {
        const next = new Set(prev);
        next.delete(removedRowId);
        return next;
      });
    }
  }

  function updateExerciseRow(
    index: number,
    key:
      | "exerciseId"
      | "baseWeightKg"
      | "targetSets"
      | "targetReps"
      | "targetWeightKg"
      | "notes",
    value: string,
  ) {
    setExerciseRows((prev) =>
      prev.map((row, currentIndex) =>
        currentIndex === index
          ? {
              ...row,
              [key]: value,
            }
          : row,
      ),
    );
  }

  function handleExerciseSelect(index: number, selectedExerciseId: string) {
    setExerciseRows((prev) =>
      prev.map((row, currentIndex) => {
        if (currentIndex !== index) {
          return row;
        }

        const defaults = exerciseDefaultsById.get(selectedExerciseId);
        if (!defaults) {
          return {
            ...row,
            exerciseId: selectedExerciseId,
          };
        }

        return {
          ...row,
          exerciseId: selectedExerciseId,
          baseWeightKg:
            row.baseWeightKg || defaults.default_base_weight_kg == null
              ? row.baseWeightKg
              : String(defaults.default_base_weight_kg),
          targetSets:
            row.targetSets || defaults.default_target_sets == null
              ? row.targetSets
              : String(defaults.default_target_sets),
          targetReps:
            row.targetReps || defaults.default_target_reps == null
              ? row.targetReps
              : String(defaults.default_target_reps),
          targetWeightKg:
            row.targetWeightKg || defaults.default_target_weight_kg == null
              ? row.targetWeightKg
              : String(defaults.default_target_weight_kg),
        };
      }),
    );
  }

  function toggleExerciseNotes(index: number) {
    setExpandedExerciseNotes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function toggleExerciseCollapsed(rowId: string) {
    setCollapsedExercises((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }

  function collapseExercise(rowId: string) {
    setCollapsedExercises((prev) => {
      const next = new Set(prev);
      next.add(rowId);
      return next;
    });
  }

  function focusExercisePicker(index: number) {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const rowRoot = document.querySelector(`[data-exercise-row-id="row-${index}"]`);
        if (!(rowRoot instanceof HTMLElement)) {
          return;
        }
        const nextFocusable = rowRoot.querySelector<HTMLElement>(
          'input, button[role="combobox"], [role="combobox"], button, [tabindex]:not([tabindex="-1"])',
        );
        nextFocusable?.focus();
      });
    });
  }

  const isCompactView = isSmallPhone;
  const visibleExerciseRows = isCompactView
    ? exerciseRows
        .map((row, index) => ({ row, index }))
        .filter(({ index }) => index === activeExerciseIndex)
    : exerciseRows.map((row, index) => ({ row, index }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-1 text-sm font-medium">
          <Dumbbell className="h-3.5 w-3.5 text-zinc-500" />
          Exercises
        </h2>
        {isCompactView && exerciseRows.length > 0 ? (
          <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-800">
            Exercise {activeExerciseIndex + 1} of {exerciseRows.length}
          </span>
        ) : null}
        <div className={`flex items-center gap-2 ${isCompactView ? "hidden" : ""}`}>
          {onClearDraft ? (
            <ActionButton
              type="button"
              onClick={onClearDraft}
              variant="secondary"
              size="sm"
              className="px-2 py-1 text-xs font-normal"
              iconColor="amber"
            >
              <Eraser className="h-3 w-3 text-amber-600" />
              Clear draft
            </ActionButton>
          ) : null}
          <ActionButton
            type="button"
            onClick={addExerciseRow}
            variant="primary"
            size="sm"
            className="px-2 py-1 text-xs font-normal"
          >
            <Plus className="h-3 w-3 text-white" />
            Add exercise
          </ActionButton>
        </div>
      </div>
      {isCompactView ? (
        <div className="grid grid-cols-2 gap-2">
          {onClearDraft ? (
            <button
              type="button"
              onClick={onClearDraft}
              className="inline-flex h-12 items-center justify-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-2 text-xs leading-tight text-zinc-800 hover:border-sky-300 hover:bg-zinc-100"
            >
              <Eraser className="h-3.5 w-3.5 text-amber-600" />
              Clear draft
            </button>
          ) : null}
          <button
            type="button"
            onClick={addExerciseRow}
            className={`inline-flex h-12 items-center justify-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-2 text-xs leading-tight text-zinc-800 hover:border-sky-300 hover:bg-zinc-100 ${
              onClearDraft ? "" : "col-span-2"
            }`}
          >
            <Plus className="h-3.5 w-3.5 text-sky-700" />
            Add exercise
          </button>
        </div>
      ) : null}
      {visibleExerciseRows.map(({ row, index }) => (
        <div
          key={row.rowId}
          data-exercise-row-id={`row-${index}`}
          onFocusCapture={() => setActiveExerciseIndex(index)}
          className={
            isCompactView
              ? "rounded-md border border-zinc-200 bg-zinc-50/70 p-3"
              : "panel panel-nested border-zinc-200 bg-zinc-50/80 p-5 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
          }
        >
          <div className="mb-2 mt-1 flex items-center justify-between">
            {isCompactView ? (
              <div className="inline-flex min-h-6 items-center leading-none text-base font-bold text-zinc-900">
                {(() => {
                  const selectedOption = row.exerciseId
                    ? exerciseOptions.find((option) => option.id === row.exerciseId)
                    : null;
                  const selectedBadge = selectedOption ? toExerciseBadge(selectedOption.slug) : null;
                  const baseTitle = selectedBadge ?? `Exercise ${index + 1}`;
                  const targetDetails = [
                    row.baseWeightKg ? `base ${row.baseWeightKg} kg` : null,
                    row.targetSets ? `${row.targetSets} sets` : null,
                    row.targetWeightKg ? `weight ${row.targetWeightKg} kg` : null,
                    row.targetReps ? `${row.targetReps} reps` : null,
                  ]
                    .filter(Boolean)
                    .join(", ");
                  const mobileTitle = targetDetails ? `${baseTitle} - ${targetDetails}` : baseTitle;
                  return <span>{mobileTitle}</span>;
                })()}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => toggleExerciseCollapsed(row.rowId)}
                className="inline-flex min-h-6 items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-zinc-100 hover:text-zinc-800"
                aria-label={
                  collapsedExercises.has(row.rowId) ? "Expand exercise" : "Collapse exercise"
                }
                title={collapsedExercises.has(row.rowId) ? "Expand exercise" : "Collapse exercise"}
              >
                <span className="inline-flex h-6 w-6 items-center justify-center">
                  {collapsedExercises.has(row.rowId) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </span>
                <span className="inline-flex h-6 items-center leading-none text-sm font-semibold text-zinc-800">
                  {(() => {
                    const baseTitle = `Exercise #${index + 1}`;
                    const label = row.exerciseId
                      ? (exerciseOptions.find((option) => option.id === row.exerciseId)?.label ??
                        row.exerciseId)
                      : null;
                    const details = [
                      row.baseWeightKg ? `base ${row.baseWeightKg} kg` : null,
                      row.targetSets ? `${row.targetSets} sets` : null,
                      row.targetWeightKg ? `weight ${row.targetWeightKg} kg` : null,
                      row.targetReps ? `${row.targetReps} reps` : null,
                    ]
                      .filter(Boolean)
                      .join(", ");

                    let desktopTitle = baseTitle;
                    if (label && details) {
                      desktopTitle = [baseTitle, `${label} (${details})`].join(" - ");
                    } else if (label) {
                      desktopTitle = [baseTitle, label].join(" - ");
                    } else if (details) {
                      desktopTitle = [baseTitle, details].join(" - ");
                    }

                    return <span>{desktopTitle}</span>;
                  })()}
                </span>
              </button>
            )}
            <div className="inline-flex min-h-6 items-center gap-2">
              {isCompactView ? (
                exerciseRows.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeExerciseRow(index)}
                    className="inline-flex h-8 w-24 items-center justify-center rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-800 hover:border-sky-300 hover:bg-zinc-100"
                  >
                    Remove
                  </button>
                ) : null
              ) : exerciseRows.length > 1 ? (
                <ActionButton
                  type="button"
                  onClick={() => removeExerciseRow(index)}
                  variant="secondary"
                  size="sm"
                  className="h-8 w-24 px-2 py-1 text-xs font-normal"
                  iconColor="zinc"
                >
                  Remove
                </ActionButton>
              ) : null}
            </div>
          </div>
          {isCompactView ? (
            <>
              <div className="mt-5 grid grid-cols-12 items-start gap-2">
                <label className="col-span-8 block text-xs font-medium">
                  <span className="inline-flex items-center gap-1">
                    <ListChecks className="h-3 w-3 text-zinc-500" />
                    Exercise
                    <span aria-hidden className="text-sky-700">
                      *
                    </span>
                  </span>
                  <ExerciseSearchSelect
                    required
                    size="compact"
                    className="mt-1 w-full"
                    options={exerciseOptionsForPicker(
                      exerciseOptions,
                      hiddenExerciseIds,
                      row.exerciseId,
                    )}
                    value={row.exerciseId}
                    onChange={(exerciseId) => handleExerciseSelect(index, exerciseId)}
                  />
                </label>
                <label className="col-span-4 block text-xs font-medium">
                  Base weight (kg)
                  <input
                    type="number"
                    min={0}
                    step="0.25"
                    value={row.baseWeightKg}
                    onChange={(event) =>
                      updateExerciseRow(index, "baseWeightKg", event.target.value)
                    }
                    className="mt-1 w-full rounded-md border bg-white px-2 py-1.5 text-sm"
                    placeholder="e.g. 20"
                  />
                  <div className="mt-1 flex flex-wrap gap-1">
                    {[20, 15, 10, 0].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          updateExerciseRow(
                            index,
                            "baseWeightKg",
                            value === 0 ? "" : String(value),
                          )
                        }
                        className="rounded border bg-white px-2 py-0.5 text-[11px]"
                      >
                        +{value}
                      </button>
                    ))}
                  </div>
                </label>
              </div>
              <div className="mt-5">
                <div className="mb-2 flex items-center gap-1">
                  <p className="text-sm font-semibold text-zinc-800">Targets</p>
                  <InfoPopover
                    label="How targets work"
                    panelAlign="left"
                    className="[&>button]:h-5 [&>button]:w-5 [&>button]:text-zinc-500"
                  >
                    <p>
                      Sets, weight, and reps here are targets for your working sets. Warmup sets are
                      tracked separately when you log the session.
                    </p>
                  </InfoPopover>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <label className="col-span-1 block text-xs font-medium">
                    Sets
                    <input
                      type="number"
                      min={1}
                      value={row.targetSets}
                      onChange={(event) =>
                        updateExerciseRow(index, "targetSets", event.target.value)
                      }
                      className="mt-1 w-full rounded-md border bg-white px-2 py-1.5 text-sm"
                      placeholder="e.g. 3"
                    />
                  </label>
                  <label className="col-span-1 block text-xs font-medium">
                    Target weight (kg)
                    <input
                      type="number"
                      min={0}
                      step="0.25"
                      value={row.targetWeightKg}
                      onChange={(event) =>
                        updateExerciseRow(index, "targetWeightKg", event.target.value)
                      }
                      className="mt-1 w-full rounded-md border bg-white px-2 py-1.5 text-sm"
                      placeholder="e.g. 60"
                    />
                  </label>
                  <label className="col-span-1 block text-xs font-medium">
                    Reps
                    <input
                      type="number"
                      min={1}
                      value={row.targetReps}
                      onChange={(event) =>
                        updateExerciseRow(index, "targetReps", event.target.value)
                      }
                      className="mt-1 w-full rounded-md border bg-white px-2 py-1.5 text-sm"
                      placeholder="e.g. 8"
                    />
                  </label>
                </div>
              </div>
              <div className="mt-6 block text-sm font-medium">
                <button
                  type="button"
                  onClick={() => toggleExerciseNotes(index)}
                  className="inline-flex items-center gap-1 text-left text-sm font-medium hover:text-sky-700"
                >
                  <NotebookPen className="h-3.5 w-3.5 text-zinc-500" />
                  {expandedExerciseNotes.has(index)
                    ? "Hide exercise notes"
                    : "Add exercise notes"}
                </button>
                {expandedExerciseNotes.has(index) ? (
                  <NotesTextareaField
                    value={row.notes}
                    onChange={(nextValue) => updateExerciseRow(index, "notes", nextValue)}
                    placeholder="Optional notes for this exercise"
                    maxLength={maxNotesLength}
                    heightClassName="h-20"
                  />
                ) : null}
              </div>
              <div className="mt-4 flex flex-col gap-1 border-t border-zinc-200 pt-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <ActionButton
                    type="button"
                    variant="primary"
                    size="sm"
                    fullWidth
                    className="font-normal"
                    disabled={!row.exerciseId}
                    onClick={() => {
                      collapseExercise(row.rowId);
                      addExerciseRow();
                      const nextRowIndex = exerciseRows.length;
                      setActiveExerciseIndex(nextRowIndex);
                      focusExercisePicker(nextRowIndex);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 text-white" />
                    Save & add next
                  </ActionButton>
                </div>
                {exerciseRows.length > 1 ? (
                  <div className="mt-2 flex gap-2 border-t border-zinc-200/70 pt-2">
                    <ActionButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      fullWidth
                      className="min-w-0 flex-1 font-normal"
                      disabled={activeExerciseIndex === 0}
                      onClick={() => setActiveExerciseIndex((prev) => Math.max(0, prev - 1))}
                    >
                      Previous exercise
                    </ActionButton>
                    {activeExerciseIndex < exerciseRows.length - 1 ? (
                      <ActionButton
                        type="button"
                        variant="secondary"
                        size="sm"
                        fullWidth
                        className="min-w-0 flex-1 font-normal"
                        disabled={!row.exerciseId}
                        onClick={() =>
                          setActiveExerciseIndex((prev) =>
                            Math.min(exerciseRows.length - 1, prev + 1),
                          )
                        }
                      >
                        <ChevronRight className="h-3.5 w-3.5 text-sky-700" />
                        Next exercise
                      </ActionButton>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </>
          ) : collapsedExercises.has(row.rowId) ? null : (
            <>
              <div className="mt-5">
                <div className="grid grid-cols-12 items-start gap-2">
                  <label className="col-span-8 block text-sm font-medium">
                    <span className="inline-flex items-center gap-1">
                      <ListChecks className="h-3.5 w-3.5 text-zinc-500" />
                      Exercise
                      <span aria-hidden className="text-sky-700">
                        *
                      </span>
                    </span>
                    <ExerciseSearchSelect
                      required
                      className="mt-1 w-full"
                      options={exerciseOptionsForPicker(
                        exerciseOptions,
                        hiddenExerciseIds,
                        row.exerciseId,
                      )}
                      value={row.exerciseId}
                      onChange={(exerciseId) => handleExerciseSelect(index, exerciseId)}
                    />
                  </label>
                  <label className="col-span-4 block text-sm font-medium">
                    Base weight (kg)
                    <input
                      type="number"
                      min={0}
                      step="0.25"
                      value={row.baseWeightKg}
                      onChange={(event) =>
                        updateExerciseRow(index, "baseWeightKg", event.target.value)
                      }
                      className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                      placeholder="e.g. 20"
                    />
                    <div className="mt-1 flex flex-wrap gap-1">
                      {[20, 15, 10, 0].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            updateExerciseRow(
                              index,
                              "baseWeightKg",
                              value === 0 ? "" : String(value),
                            )
                          }
                          className="rounded border bg-white px-2 py-0.5 text-xs"
                        >
                          +{value}
                        </button>
                      ))}
                    </div>
                  </label>
                </div>
              </div>
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-semibold text-zinc-800">Targets</p>
                    <InfoPopover label="How targets work" className="[&>button]:text-zinc-500">
                      <p>
                        Sets, weight, and reps here are targets for your working sets. Warmup sets
                        are tracked separately when you log the session.
                      </p>
                    </InfoPopover>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <div className="grid grid-cols-12 items-end gap-2">
                  <label className="col-span-4 block text-sm font-medium">
                    Sets
                    <input
                      type="number"
                      min={1}
                      value={row.targetSets}
                      onChange={(event) =>
                        updateExerciseRow(index, "targetSets", event.target.value)
                      }
                      className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                      placeholder="e.g. 3"
                    />
                  </label>
                  <label className="col-span-4 block text-sm font-medium">
                    Target weight (kg)
                    <input
                      type="number"
                      min={0}
                      step="0.25"
                      value={row.targetWeightKg}
                      onChange={(event) =>
                        updateExerciseRow(index, "targetWeightKg", event.target.value)
                      }
                      className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                      placeholder="e.g. 60"
                    />
                  </label>
                  <label className="col-span-4 block text-sm font-medium">
                    Reps
                    <input
                      type="number"
                      min={1}
                      value={row.targetReps}
                      onChange={(event) =>
                        updateExerciseRow(index, "targetReps", event.target.value)
                      }
                      className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                      placeholder="e.g. 8"
                    />
                  </label>
                </div>
              </div>
              <div className="mt-5 block text-sm font-medium">
                <button
                  type="button"
                  onClick={() => toggleExerciseNotes(index)}
                  className="inline-flex items-center gap-1 text-left text-sm font-medium hover:text-sky-700"
                >
                  <NotebookPen className="h-3.5 w-3.5 text-zinc-500" />
                  {expandedExerciseNotes.has(index)
                    ? "Hide exercise notes"
                    : "Add exercise notes"}
                </button>
                {expandedExerciseNotes.has(index) ? (
                  <NotesTextareaField
                    value={row.notes}
                    onChange={(nextValue) => updateExerciseRow(index, "notes", nextValue)}
                    placeholder="Optional notes for this exercise"
                    maxLength={maxNotesLength}
                    heightClassName="h-20"
                  />
                ) : null}
              </div>
              <div className="mt-5 flex flex-col items-end gap-1 border-t border-zinc-200 pt-4">
                <div className="flex w-full flex-col items-stretch justify-end gap-2 sm:w-1/3 sm:flex-row sm:items-center">
                  <ActionButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="font-normal sm:flex-1"
                    disabled={!row.exerciseId}
                    onClick={() => collapseExercise(row.rowId)}
                  >
                    <Check className="h-3.5 w-3.5 text-sky-700" />
                    Save exercise
                  </ActionButton>
                  <ActionButton
                    type="button"
                    variant="primary"
                    size="sm"
                    className="font-normal sm:flex-1"
                    disabled={!row.exerciseId}
                    onClick={() => {
                      collapseExercise(row.rowId);
                      addExerciseRow();
                      focusExercisePicker(exerciseRows.length);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 text-white" />
                    Save & add next
                  </ActionButton>
                </div>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
