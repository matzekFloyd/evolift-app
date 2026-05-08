"use client";

import { ArrowLeft, CalendarDays, CalendarPlus, Check, NotebookPen, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import { ActionButton } from "@/app/components/action-button";
import { DateInput } from "@/app/components/date-input";
import { PageShell } from "@/app/components/page-shell";
import { StatusNotice } from "@/app/components/status-notice";
import { WorkoutExerciseDraftList } from "@/app/components/workout-exercise-draft-list";
import type { Database } from "@/lib/supabase/database.types";
import {
  createEmptyExerciseRow,
  exerciseDraftRowsFromTemplateLines,
  type ExerciseDraftRow,
} from "@/lib/workout-exercise-draft";
import { getTodayYyyyMmDd } from "@/lib/session-date";
import type { WorkoutTemplateWithExercises } from "@/server/db/templates";

const NEW_SESSION_DRAFT_KEY = "evolift:new-session-draft";

type NewSessionDraft = {
  performedOn: string;
  notes: string;
  exerciseRows: ExerciseDraftRow[];
};

type ExerciseDefaultsRow = Database["public"]["Tables"]["user_exercise_defaults"]["Row"];

export default function NewSessionPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  /** Start empty for SSR/client match; local "today" is applied in useLayoutEffect before paint. */
  const [performedOn, setPerformedOn] = useState("");
  const [notes, setNotes] = useState("");
  const [isSessionNotesExpanded, setIsSessionNotesExpanded] = useState(false);
  const [exerciseOptions, setExerciseOptions] = useState<
    Array<{ id: string; label: string; slug: string }>
  >([]);
  const [exerciseRows, setExerciseRows] = useState<ExerciseDraftRow[]>([
    createEmptyExerciseRow(),
  ]);
  const [exerciseDefaultsById, setExerciseDefaultsById] = useState<
    Map<string, ExerciseDefaultsRow>
  >(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [createMode, setCreateMode] = useState<"home" | "log">("home");
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"error" | "success">("error");
  const [hiddenExerciseIds, setHiddenExerciseIds] = useState<Set<string>>(new Set());
  const [templateOptions, setTemplateOptions] = useState<
    Array<{ id: string; name: string; exerciseCount: number }>
  >([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templatePickMessage, setTemplatePickMessage] = useState<string | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<WorkoutTemplateWithExercises | null>(
    null,
  );
  const [isSmallPhone, setIsSmallPhone] = useState(false);
  const maxNotesLength = 500;

  const trimmedNotes = useMemo(() => notes.trim(), [notes]);

  function getDraftStorageKey(currentUserId: string): string {
    return `${NEW_SESSION_DRAFT_KEY}:${currentUserId}`;
  }

  function showError(messageText: string) {
    setMessageTone("error");
    setMessage(messageText);
  }

  function clearMessage() {
    setMessage(null);
  }

  function resetDraftState() {
    setPerformedOn(getTodayYyyyMmDd());
    setNotes("");
    setIsSessionNotesExpanded(false);
    setExerciseRows([createEmptyExerciseRow()]);
    setSelectedTemplateId("");
    setTemplatePickMessage(null);
    setPendingTemplate(null);
  }

  function hasMeaningfulExerciseDraft(rows: ExerciseDraftRow[]): boolean {
    return rows.some((row) => row.exerciseId.trim().length > 0);
  }

  function applyTemplateToDraft(
    template: WorkoutTemplateWithExercises,
    mode: "replace" | "append",
  ) {
    const incoming = exerciseDraftRowsFromTemplateLines(template.exercises);
    if (mode === "replace") {
      setExerciseRows(incoming.length > 0 ? incoming : [createEmptyExerciseRow()]);
    } else {
      setExerciseRows((prev) => {
        const base = hasMeaningfulExerciseDraft(prev) ? prev : [];
        const trimmed = base.filter((row) => row.exerciseId.trim().length > 0);
        return [...trimmed, ...incoming];
      });
    }
    setTemplatePickMessage(null);
    setPendingTemplate(null);
    setSelectedTemplateId(template.id);
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

      const { data: hiddenRows, error: hiddenError } = await supabaseBrowserClient
        .from("user_hidden_exercises")
        .select("exercise_id")
        .eq("user_id", session.user.id);

      if (!isMounted) {
        return;
      }

      if (hiddenError) {
        showError("Could not load exercise visibility.");
        setIsChecking(false);
        return;
      }

      const hiddenSet = new Set<string>();
      for (const row of hiddenRows ?? []) {
        hiddenSet.add(row.exercise_id);
      }

      const { data: templateRows, error: templatesError } = await supabaseBrowserClient
        .from("workout_templates")
        .select("id, name, workout_template_exercises(id)")
        .order("name", { ascending: true });

      if (!isMounted) {
        return;
      }

      if (templatesError) {
        showError("Could not load templates.");
        setIsChecking(false);
        return;
      }

      const templateOpts = (templateRows ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        exerciseCount: row.workout_template_exercises?.length ?? 0,
      }));

      setExerciseOptions(options);
      setExerciseDefaultsById(defaultsMap);
      setHiddenExerciseIds(hiddenSet);
      setTemplateOptions(templateOpts);
      setIsChecking(false);
    }

    void checkSession();

    return () => {
      isMounted = false;
    };
  }, [router]);

  useLayoutEffect(() => {
    setPerformedOn((current) => (current ? current : getTodayYyyyMmDd()));
  }, []);

  /** Draft restore from localStorage is deferred to a follow-up (resume / discard UI). Autosave still runs below. */
  useEffect(() => {
    if (!userId || isChecking || !performedOn) {
      return;
    }

    const draft: NewSessionDraft = {
      performedOn,
      notes,
      exerciseRows,
    };

    window.localStorage.setItem(getDraftStorageKey(userId), JSON.stringify(draft));
  }, [exerciseRows, isChecking, notes, performedOn, userId]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsSmallPhone(mediaQuery.matches);
    apply();
    const onChange = () => apply();
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

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
      showError(`Could not create workout session: ${error?.message ?? "Unknown error"}`);
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

  function clearDraft() {
    if (userId) {
      window.localStorage.removeItem(getDraftStorageKey(userId));
    }
    setMessage(null);
    resetDraftState();
  }

  async function handleTemplateSelectionChange(templateId: string) {
    setSelectedTemplateId(templateId);
    setTemplatePickMessage(null);
    setPendingTemplate(null);
    if (!templateId) {
      return;
    }

    const { data, error } = await supabaseBrowserClient
      .from("workout_templates")
      .select(
        `
        id,
        user_id,
        name,
        notes,
        created_at,
        updated_at,
        workout_template_exercises (
          id,
          template_id,
          exercise_id,
          position,
          target_sets,
          target_reps,
          target_weight_kg,
          base_weight_kg,
          notes,
          created_at
        )
      `,
      )
      .eq("id", templateId)
      .single();

    if (error || !data) {
      showError("Could not load that template.");
      setSelectedTemplateId("");
      return;
    }

    const exercises = [...(data.workout_template_exercises ?? [])].sort(
      (a, b) => a.position - b.position,
    );
    const full: WorkoutTemplateWithExercises = {
      id: data.id,
      user_id: data.user_id,
      name: data.name,
      notes: data.notes,
      created_at: data.created_at,
      updated_at: data.updated_at,
      exercises,
    };

    if (hasMeaningfulExerciseDraft(exerciseRows)) {
      setPendingTemplate(full);
      setTemplatePickMessage(
        "Your draft already has exercises. Replace them with this template, or append the template exercises after them.",
      );
      return;
    }

    applyTemplateToDraft(full, "replace");
  }

  function goBack() {
    clearMessage();
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }

  if (isChecking) {
    return (
      <PageShell className="items-center justify-center">
        <p className="text-sm text-zinc-600">Checking session...</p>
      </PageShell>
    );
  }

  const isCompactView = isSmallPhone;

  return (
    <PageShell className={isCompactView ? "pb-36" : undefined}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <CalendarPlus className="h-6 w-6 text-sky-700" />
          New workout session
        </h1>
        <ActionButton type="button" onClick={goBack} variant="secondary" size="md">
          <ArrowLeft className="h-4 w-4 text-sky-700" />
          Back
        </ActionButton>
      </div>
      <section className="text-sm">
        <form id="new-session-form" onSubmit={handleCreateSession} className="space-y-4">
          <label className="block text-sm font-medium">
            <span className="text-zinc-800">Start from template (optional)</span>
            <select
              value={selectedTemplateId}
              onChange={(event) => void handleTemplateSelectionChange(event.target.value)}
              className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
            >
              <option value="">None — build from scratch</option>
              {templateOptions.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                  {template.exerciseCount > 0 ? ` (${template.exerciseCount} exercises)` : ""}
                </option>
              ))}
            </select>
          </label>
          {templateOptions.length === 0 ? (
            <p className="text-xs text-zinc-600">
              No templates yet.{" "}
              <Link
                href="/templates/new"
                className="font-medium text-sky-800 underline-offset-2 hover:underline"
              >
                Create a template
              </Link>
              {" · "}
              <Link
                href="/templates"
                className="font-medium text-sky-800 underline-offset-2 hover:underline"
              >
                Manage templates
              </Link>
            </p>
          ) : (
            <p className="text-xs text-zinc-600">
              <Link
                href="/templates"
                className="font-medium text-sky-800 underline-offset-2 hover:underline"
              >
                Manage templates
              </Link>
            </p>
          )}
          {pendingTemplate ? (
            <div className="rounded-md border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-950">
              <p className="font-medium">Apply template &quot;{pendingTemplate.name}&quot;</p>
              {templatePickMessage ? (
                <p className="mt-1 text-xs text-amber-900/90">{templatePickMessage}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <ActionButton
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={() => applyTemplateToDraft(pendingTemplate, "replace")}
                >
                  Replace exercises
                </ActionButton>
                <ActionButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => applyTemplateToDraft(pendingTemplate, "append")}
                >
                  Append exercises
                </ActionButton>
                <ActionButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setPendingTemplate(null);
                    setTemplatePickMessage(null);
                    setSelectedTemplateId("");
                  }}
                >
                  Cancel
                </ActionButton>
              </div>
            </div>
          ) : null}
          <label className="block text-sm font-medium">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5 text-zinc-500" />
              Performed on
            </span>
            <DateInput
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

          {message ? (
            <StatusNotice message={message} tone={messageTone} onDismiss={clearMessage} />
          ) : null}

          <WorkoutExerciseDraftList
            exerciseRows={exerciseRows}
            setExerciseRows={setExerciseRows}
            exerciseOptions={exerciseOptions}
            hiddenExerciseIds={hiddenExerciseIds}
            exerciseDefaultsById={exerciseDefaultsById}
            maxNotesLength={maxNotesLength}
            onClearDraft={clearDraft}
          />

          <div className={`flex items-center justify-end gap-3 ${isCompactView ? "hidden" : ""}`}>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
              <ActionButton
                type="submit"
                disabled={isSaving}
                onClick={() => setCreateMode("home")}
                variant="secondary"
                size="md"
                fullWidth
                className="sm:w-44"
              >
                <Check className="h-3.5 w-3.5 text-sky-700" />
                Create
              </ActionButton>
              <ActionButton
                type="submit"
                disabled={isSaving}
                onClick={() => setCreateMode("log")}
                variant="primary"
                size="md"
                fullWidth
                className="sm:w-44"
              >
                <Play className="h-3.5 w-3.5 text-white" />
                Create & log sets
              </ActionButton>
            </div>
          </div>
        </form>
      </section>
      {isCompactView ? (
        <div
          id="new-session-compact-create"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 p-3 shadow-[0_-6px_16px_rgba(0,0,0,0.08)] backdrop-blur md:hidden"
        >
          <div className="mx-auto flex w-full max-w-5xl items-center gap-2">
            <button
              type="submit"
              form="new-session-form"
              onClick={() => setCreateMode("home")}
              disabled={isSaving}
              className="inline-flex h-11 flex-1 items-center justify-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-3 text-sm font-medium text-zinc-800 hover:border-sky-300 hover:bg-zinc-100 disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5 text-sky-700" />
              Create
            </button>
            <button
              type="submit"
              form="new-session-form"
              onClick={() => setCreateMode("log")}
              disabled={isSaving}
              className="inline-flex h-11 flex-1 items-center justify-center gap-1 rounded-md border border-sky-700 bg-sky-700 px-3 text-sm font-medium text-white hover:border-sky-600 hover:bg-sky-600 disabled:opacity-60"
            >
              <Play className="h-3.5 w-3.5 text-white" />
              Create & log sets
            </button>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
