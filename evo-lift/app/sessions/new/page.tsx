"use client";

import { ArrowLeft, CalendarPlus } from "lucide-react";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Check,
  Dumbbell,
  Eraser,
  ListChecks,
  NotebookPen,
  Plus,
  Play,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/database.types";
import { toExerciseBadge } from "@/lib/exercise-badge";

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const NEW_SESSION_DRAFT_KEY = "evolift:new-session-draft";

type ExerciseDraftRow = {
  exerciseId: string;
  baseWeightKg: string;
  targetSets: string;
  targetReps: string;
  targetWeightKg: string;
  notes: string;
};

type NewSessionDraft = {
  performedOn: string;
  notes: string;
  exerciseRows: ExerciseDraftRow[];
};

type ExerciseDefaultsRow = Database["public"]["Tables"]["user_exercise_defaults"]["Row"];

const emptyExerciseRow: ExerciseDraftRow = {
  exerciseId: "",
  baseWeightKg: "",
  targetSets: "",
  targetReps: "",
  targetWeightKg: "",
  notes: "",
};

export default function NewSessionPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [performedOn, setPerformedOn] = useState(getTodayDateString);
  const [notes, setNotes] = useState("");
  const [isSessionNotesExpanded, setIsSessionNotesExpanded] = useState(false);
  const [exerciseOptions, setExerciseOptions] = useState<
    Array<{ id: string; label: string; slug: string }>
  >([]);
  const [exerciseRows, setExerciseRows] = useState<ExerciseDraftRow[]>([
    emptyExerciseRow,
  ]);
  const [exerciseDefaultsById, setExerciseDefaultsById] = useState<
    Map<string, ExerciseDefaultsRow>
  >(new Map());
  const [expandedExerciseNotes, setExpandedExerciseNotes] = useState<Set<number>>(new Set());
  const [collapsedExercises, setCollapsedExercises] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [savingDefaultsRowIndex, setSavingDefaultsRowIndex] = useState<number | null>(null);
  const [createMode, setCreateMode] = useState<"home" | "log">("home");
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"error" | "success">("error");
  const maxNotesLength = 500;

  const trimmedNotes = useMemo(() => notes.trim(), [notes]);

  function getDraftStorageKey(currentUserId: string): string {
    return `${NEW_SESSION_DRAFT_KEY}:${currentUserId}`;
  }

  function showError(messageText: string) {
    setMessageTone("error");
    setMessage(messageText);
  }

  function showSuccess(messageText: string) {
    setMessageTone("success");
    setMessage(messageText);
  }

  function resetDraftState() {
    setPerformedOn(getTodayDateString());
    setNotes("");
    setIsSessionNotesExpanded(false);
    setExerciseRows([{ ...emptyExerciseRow }]);
    setExpandedExerciseNotes(new Set());
    setCollapsedExercises(new Set());
  }

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabaseBrowserClient.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (!session) {
        router.replace("/login");
        return;
      }

      setUserId(session.user.id);
      const { data: exercises, error: exercisesError } = await supabaseBrowserClient
        .from("exercises")
        .select("id, slug")
        .order("slug", { ascending: true });

      if (!isMounted) {
        return;
      }

      if (exercisesError) {
        showError("Could not load exercises.");
        setIsChecking(false);
        return;
      }

      const { data: translations } = await supabaseBrowserClient
        .from("exercise_translations")
        .select("exercise_id, lang_code, name")
        .eq("lang_code", "en");

      const translationMap = new Map<string, string>();
      for (const row of translations ?? []) {
        translationMap.set(row.exercise_id, row.name);
      }

      const options = (exercises ?? []).map((exercise) => ({
        id: exercise.id,
        label: translationMap.get(exercise.id) ?? exercise.slug,
        slug: exercise.slug,
      }));

      const { data: defaultsData, error: defaultsError } = await supabaseBrowserClient
        .from("user_exercise_defaults")
        .select("*")
        .eq("user_id", session.user.id);
      if (defaultsError) {
        showError("Could not load exercise defaults.");
        setIsChecking(false);
        return;
      }
      const defaultsMap = new Map<string, ExerciseDefaultsRow>();
      for (const item of defaultsData ?? []) {
        defaultsMap.set(item.exercise_id, item);
      }

      setExerciseOptions(options);
      setExerciseDefaultsById(defaultsMap);
      setIsChecking(false);
    }

    void checkSession();

    return () => {
      isMounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    try {
      const raw = window.localStorage.getItem(getDraftStorageKey(userId));
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Partial<NewSessionDraft>;
      if (parsed.performedOn) {
        setPerformedOn(parsed.performedOn);
      }
      if (typeof parsed.notes === "string") {
        setNotes(parsed.notes);
        setIsSessionNotesExpanded(parsed.notes.trim().length > 0);
      }
      if (Array.isArray(parsed.exerciseRows) && parsed.exerciseRows.length > 0) {
        const preExpanded = new Set<number>();
        parsed.exerciseRows.forEach((row, index) => {
          if (typeof row.notes === "string" && row.notes.trim().length > 0) {
            preExpanded.add(index);
          }
        });
        setExerciseRows(
          parsed.exerciseRows.map((row) => ({
            exerciseId: row.exerciseId ?? "",
            baseWeightKg: row.baseWeightKg ?? "",
            targetSets: row.targetSets ?? "",
            targetReps: row.targetReps ?? "",
            targetWeightKg: row.targetWeightKg ?? "",
            notes: row.notes ?? "",
          })),
        );
        setExpandedExerciseNotes(preExpanded);
      }
    } catch {
      // Ignore invalid local draft payloads.
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || isChecking) {
      return;
    }

    const draft: NewSessionDraft = {
      performedOn,
      notes,
      exerciseRows,
    };

    window.localStorage.setItem(getDraftStorageKey(userId), JSON.stringify(draft));
  }, [exerciseRows, isChecking, notes, performedOn, userId]);

  async function handleCreateSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      showError("You must be logged in to create a workout session.");
      return;
    }
    if (!performedOn) {
      showError("Please choose a performed date.");
      return;
    }
    if (exerciseRows.length === 0) {
      showError("Add at least one exercise.");
      return;
    }
    if (exerciseRows.some((row) => !row.exerciseId)) {
      showError("Please choose an exercise for each row.");
      return;
    }
    if (
      exerciseRows.some((row) => {
        if (!row.baseWeightKg) {
          return false;
        }
        const value = Number(row.baseWeightKg);
        return !Number.isFinite(value) || value < 0;
      })
    ) {
      showError("Please enter a valid base weight for each exercise.");
      return;
    }

    setIsSaving(true);
    setMessage(null);

    const { data: sessionInsert, error } = await supabaseBrowserClient
      .from("workout_sessions")
      .insert({
        user_id: userId,
        performed_on: performedOn,
        notes: trimmedNotes.length > 0 ? trimmedNotes : null,
      })
      .select("id")
      .single();

    if (error || !sessionInsert) {
      showError(`Could not create workout session: ${error.message}`);
      setIsSaving(false);
      return;
    }

    const exerciseInserts: Database["public"]["Tables"]["workout_session_exercises"]["Insert"][] =
      exerciseRows.map((row, index) => {
        const parsedSets = row.targetSets ? Number(row.targetSets) : null;
        const parsedReps = row.targetReps ? Number(row.targetReps) : null;
        const parsedWeight = row.targetWeightKg ? Number(row.targetWeightKg) : null;
        const parsedBaseWeight = row.baseWeightKg ? Number(row.baseWeightKg) : null;

        return {
          session_id: sessionInsert.id,
          exercise_id: row.exerciseId,
          position: index + 1,
          base_weight_kg: Number.isFinite(parsedBaseWeight) ? parsedBaseWeight : null,
          target_sets: Number.isFinite(parsedSets) ? parsedSets : null,
          target_reps: Number.isFinite(parsedReps) ? parsedReps : null,
          target_weight_kg: Number.isFinite(parsedWeight) ? parsedWeight : null,
          notes: row.notes.trim() ? row.notes.trim() : null,
        };
      });

    const { error: exercisesInsertError } = await supabaseBrowserClient
      .from("workout_session_exercises")
      .insert(exerciseInserts);

    if (exercisesInsertError) {
      await supabaseBrowserClient
        .from("workout_sessions")
        .delete()
        .eq("id", sessionInsert.id);
      showError(
        `Could not create workout session exercises: ${exercisesInsertError.message}`,
      );
      setIsSaving(false);
      return;
    }

    window.localStorage.removeItem(getDraftStorageKey(userId));
    router.replace(createMode === "log" ? `/sessions/${sessionInsert.id}` : "/");
  }

  function addExerciseRow() {
    setExerciseRows((prev) => [
      ...prev,
      { ...emptyExerciseRow },
    ]);
  }

  function removeExerciseRow(index: number) {
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
    setCollapsedExercises((prev) => {
      const next = new Set<number>();
      for (const currentIndex of prev) {
        if (currentIndex === index) {
          continue;
        }
        next.add(currentIndex > index ? currentIndex - 1 : currentIndex);
      }
      return next;
    });
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

  async function saveExerciseDefaults(index: number) {
    if (!userId) {
      showError("You must be logged in to save defaults.");
      return;
    }

    const row = exerciseRows[index];
    if (!row || !row.exerciseId) {
      showError("Select an exercise first.");
      return;
    }

    const parsedBaseWeight = row.baseWeightKg ? Number(row.baseWeightKg) : null;
    const parsedSets = row.targetSets ? Number(row.targetSets) : null;
    const parsedReps = row.targetReps ? Number(row.targetReps) : null;
    const parsedTargetWeight = row.targetWeightKg ? Number(row.targetWeightKg) : null;

    if (parsedBaseWeight !== null && (!Number.isFinite(parsedBaseWeight) || parsedBaseWeight < 0)) {
      showError("Please enter a valid base weight before saving defaults.");
      return;
    }
    if (parsedSets !== null && (!Number.isFinite(parsedSets) || parsedSets <= 0)) {
      showError("Please enter a valid target sets value before saving defaults.");
      return;
    }
    if (parsedReps !== null && (!Number.isFinite(parsedReps) || parsedReps <= 0)) {
      showError("Please enter a valid target reps value before saving defaults.");
      return;
    }
    if (
      parsedTargetWeight !== null &&
      (!Number.isFinite(parsedTargetWeight) || parsedTargetWeight < 0)
    ) {
      showError("Please enter a valid target weight before saving defaults.");
      return;
    }

    setSavingDefaultsRowIndex(index);
    setMessage(null);

    const payload: Database["public"]["Tables"]["user_exercise_defaults"]["Insert"] = {
      user_id: userId,
      exercise_id: row.exerciseId,
      default_base_weight_kg: parsedBaseWeight,
      default_target_sets: parsedSets,
      default_target_reps: parsedReps,
      default_target_weight_kg: parsedTargetWeight,
    };

    const { data, error } = await supabaseBrowserClient
      .from("user_exercise_defaults")
      .upsert(payload, { onConflict: "user_id,exercise_id" })
      .select("*")
      .single();

    if (error || !data) {
      showError(`Could not save defaults: ${error?.message ?? "Unknown error"}`);
      setSavingDefaultsRowIndex(null);
      return;
    }

    setExerciseDefaultsById((prev) => {
      const next = new Map(prev);
      next.set(data.exercise_id, data);
      return next;
    });
    setSavingDefaultsRowIndex(null);
    showSuccess("Defaults saved for this exercise.");
  }

  function clearDraft() {
    if (userId) {
      window.localStorage.removeItem(getDraftStorageKey(userId));
    }
    setMessage(null);
    resetDraftState();
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

  function toggleExerciseCollapsed(index: number) {
    setCollapsedExercises((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }

  if (isChecking) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-sm text-zinc-600">Checking session...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-12 sm:px-6 sm:py-16">
      <div className="flex items-center justify-between gap-3">
        <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <CalendarPlus className="h-6 w-6 text-sky-700" />
          New workout session
        </h1>
        <button
          type="button"
          onClick={goBack}
          className="inline-flex w-fit items-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-800 hover:border-sky-300 hover:bg-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>
      <section className="panel p-5 text-sm">
        <form onSubmit={handleCreateSession} className="space-y-4">
          <label className="block text-sm font-medium">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5 text-zinc-500" />
              Performed on
            </span>
            <input
              type="date"
              required
              value={performedOn}
              onChange={(event) => setPerformedOn(event.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>

          <div className="block text-sm font-medium">
            <button
              type="button"
              onClick={() => setIsSessionNotesExpanded((prev) => !prev)}
              className="inline-flex items-center gap-1 text-left hover:text-sky-700"
            >
              <NotebookPen className="h-3.5 w-3.5 text-zinc-500" />
              {isSessionNotesExpanded ? "Hide notes" : "Add notes (optional)"}
            </button>
            {isSessionNotesExpanded ? (
              <>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="mt-1 h-28 w-full rounded-md border px-3 py-2 text-sm"
                  maxLength={maxNotesLength}
                  placeholder="Optional session notes"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  {notes.length}/{maxNotesLength}
                </p>
              </>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="inline-flex items-center gap-1 text-sm font-medium">
                <Dumbbell className="h-3.5 w-3.5 text-zinc-500" />
                Exercises
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearDraft}
                  className="inline-flex items-center gap-1 text-xs underline"
                >
                  <Eraser className="h-3 w-3" />
                  Clear draft
                </button>
                <button
                  type="button"
                  onClick={addExerciseRow}
                    className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-800 hover:border-sky-300 hover:bg-zinc-100"
                >
                  <Plus className="h-3 w-3" />
                  Add exercise
                </button>
              </div>
            </div>
            {exerciseRows.map((row, index) => (
              <div
                key={index}
                className={`panel panel-nested p-3 ${
                  index % 2 === 0 ? "panel-nested-odd" : "panel-nested-even"
                }`}
              >
                {/** Optional per-exercise notes are collapsed by default for less visual noise. */}
                <div className="mb-2 mt-1 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => toggleExerciseCollapsed(index)}
                    className="inline-flex min-h-6 items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-zinc-100 hover:text-zinc-800"
                    aria-label={
                      collapsedExercises.has(index) ? "Expand exercise" : "Collapse exercise"
                    }
                    title={collapsedExercises.has(index) ? "Expand exercise" : "Collapse exercise"}
                  >
                    <span className="inline-flex h-6 w-6 items-center justify-center">
                      {collapsedExercises.has(index) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronUp className="h-4 w-4" />
                      )}
                    </span>
                    <span className="inline-flex h-6 items-center leading-none text-sm font-medium text-zinc-600">
                      {(() => {
                        const baseTitle = `Exercise #${index + 1}`;
                        const label = row.exerciseId
                          ? (exerciseOptions.find((option) => option.id === row.exerciseId)?.label ??
                            row.exerciseId)
                          : null;
                        const details = [
                          row.baseWeightKg ? `base ${row.baseWeightKg} kg` : null,
                          row.targetSets ? `${row.targetSets} sets` : null,
                          row.targetReps ? `${row.targetReps} reps` : null,
                          row.targetWeightKg ? `target ${row.targetWeightKg} kg` : null,
                        ]
                          .filter(Boolean)
                          .join(", ");

                        const mobileTitle = [baseTitle, label].filter(Boolean).join(" - ");

                        let desktopTitle = baseTitle;
                        if (label && details) {
                          desktopTitle = [baseTitle, `${label} (${details})`].join(" - ");
                        } else if (label) {
                          desktopTitle = [baseTitle, label].join(" - ");
                        } else if (details) {
                          desktopTitle = [baseTitle, details].join(" - ");
                        }

                        return (
                          <>
                            <span className="md:hidden">{mobileTitle}</span>
                            <span className="hidden md:inline">{desktopTitle}</span>
                          </>
                        );
                      })()}
                    </span>
                  </button>
                  <div className="inline-flex min-h-6 items-center gap-2">
                    {exerciseRows.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeExerciseRow(index)}
                        className="inline-flex items-center text-xs underline"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
                {collapsedExercises.has(index) ? null : (
                  <>
                <label className="mt-2 block text-sm font-medium">
                  <span className="inline-flex items-center gap-1">
                    <ListChecks className="h-3.5 w-3.5 text-zinc-500" />
                    Exercise
                  </span>
                  <select
                    required
                    value={row.exerciseId}
                    onChange={(event) => handleExerciseSelect(index, event.target.value)}
                    className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Select exercise</option>
                    {exerciseOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label} ({toExerciseBadge(option.slug)})
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="block text-sm font-medium">
                    Base weight (kg)
                    <input
                      type="number"
                      min={0}
                      step="0.5"
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
                  <label className="block text-sm font-medium">
                    Target sets
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
                  <label className="block text-sm font-medium">
                    Target reps
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
                  <label className="block text-sm font-medium">
                    Target weight (kg)
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      value={row.targetWeightKg}
                      onChange={(event) =>
                        updateExerciseRow(index, "targetWeightKg", event.target.value)
                      }
                      className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                      placeholder="e.g. 60"
                    />
                  </label>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => saveExerciseDefaults(index)}
                    disabled={savingDefaultsRowIndex === index || !row.exerciseId}
                    className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-800 hover:border-sky-300 hover:bg-zinc-100 disabled:opacity-60"
                  >
                    {savingDefaultsRowIndex === index ? "Saving..." : "Save as default"}
                  </button>
                </div>
                <div className="mt-3 block text-sm font-medium">
                  <button
                    type="button"
                    onClick={() => toggleExerciseNotes(index)}
                    className="inline-flex items-center gap-1 text-left hover:text-sky-700"
                  >
                    {expandedExerciseNotes.has(index)
                      ? "Hide exercise notes"
                      : "Add exercise notes (optional)"}
                  </button>
                  {expandedExerciseNotes.has(index) ? (
                    <input
                      type="text"
                      value={row.notes}
                      onChange={(event) =>
                        updateExerciseRow(index, "notes", event.target.value)
                      }
                      className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                      placeholder="Optional notes for this exercise"
                    />
                  ) : null}
                </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3">
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
              <button
                type="submit"
                disabled={isSaving}
                onClick={() => setCreateMode("home")}
                className="inline-flex h-10 w-full items-center justify-center gap-1 rounded-md border border-sky-700 bg-sky-700 px-3 py-2 text-sm text-white hover:border-sky-600 hover:bg-sky-600 disabled:opacity-60 sm:w-44"
              >
                <Check className="h-3.5 w-3.5" />
                Create
              </button>
              <button
                type="submit"
                disabled={isSaving}
                onClick={() => setCreateMode("log")}
                className="inline-flex h-10 w-full items-center justify-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 hover:border-sky-300 hover:bg-zinc-100 disabled:opacity-60 sm:w-44"
              >
                <Play className="h-3.5 w-3.5" />
                Create + log sets
              </button>
            </div>
          </div>
        </form>
      </section>
      {message ? (
        <section
          className={`panel p-4 text-sm ${
            messageTone === "error" ? "text-red-600" : "text-emerald-700"
          }`}
        >
          {message}
        </section>
      ) : null}
    </main>
  );
}
