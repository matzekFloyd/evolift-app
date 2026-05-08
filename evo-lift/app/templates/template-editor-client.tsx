"use client";

import { ArrowLeft, FileStack } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/app/components/action-button";
import { PageShell } from "@/app/components/page-shell";
import { StatusNotice } from "@/app/components/status-notice";
import { WorkoutExerciseDraftList } from "@/app/components/workout-exercise-draft-list";
import type { Database } from "@/lib/supabase/database.types";
import {
  createEmptyExerciseRow,
  exerciseDraftRowsFromTemplateLines,
  type ExerciseDraftRow,
} from "@/lib/workout-exercise-draft";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import {
  createUserTemplate,
  updateUserTemplate,
} from "@/server/actions/templates";
import type { WorkoutTemplateWithExercises } from "@/server/db/templates";

type ExerciseDefaultsRow = Database["public"]["Tables"]["user_exercise_defaults"]["Row"];

type TemplateDraftPayload = {
  name: string;
  notes: string;
  exerciseRows: ExerciseDraftRow[];
};

function getTemplateDraftStorageKey(userId: string, scope: string): string {
  return `evolift:template-draft:${userId}:${scope}`;
}

type Props =
  | { mode: "create" }
  | { mode: "edit"; templateId: string; initial: WorkoutTemplateWithExercises };

export function TemplateEditorClient(props: Props) {
  const router = useRouter();
  const draftScope = props.mode === "create" ? "new" : props.templateId;
  const [isChecking, setIsChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState(() =>
    props.mode === "edit" ? props.initial.name : "",
  );
  const [notes, setNotes] = useState(() =>
    props.mode === "edit" ? (props.initial.notes ?? "") : "",
  );
  const [exerciseRows, setExerciseRows] = useState<ExerciseDraftRow[]>(() =>
    props.mode === "edit"
      ? exerciseDraftRowsFromTemplateLines(props.initial.exercises)
      : [createEmptyExerciseRow()],
  );
  const [exerciseOptions, setExerciseOptions] = useState<
    Array<{ id: string; label: string; slug: string }>
  >([]);
  const [exerciseDefaultsById, setExerciseDefaultsById] = useState<
    Map<string, ExerciseDefaultsRow>
  >(new Map());
  const [hiddenExerciseIds, setHiddenExerciseIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"error" | "success">("error");
  const [isSaving, setIsSaving] = useState(false);

  const maxNotesLength = 500;
  const title = props.mode === "create" ? "New template" : "Edit template";

  function showError(text: string) {
    setMessageTone("error");
    setMessage(text);
  }

  function clearMessage() {
    setMessage(null);
  }

  function resetDraftState() {
    setName(props.mode === "edit" ? props.initial.name : "");
    setNotes(props.mode === "edit" ? (props.initial.notes ?? "") : "");
    setExerciseRows(
      props.mode === "edit"
        ? exerciseDraftRowsFromTemplateLines(props.initial.exercises)
        : [createEmptyExerciseRow()],
    );
  }

  function clearDraft() {
    if (userId) {
      window.localStorage.removeItem(getTemplateDraftStorageKey(userId, draftScope));
    }
    clearMessage();
    resetDraftState();
  }

  useEffect(() => {
    let isMounted = true;

    async function load() {
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

      setExerciseOptions(options);
      setExerciseDefaultsById(defaultsMap);
      setHiddenExerciseIds(hiddenSet);
      setIsChecking(false);
    }

    void load();
    return () => {
      isMounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (!userId || isChecking) {
      return;
    }
    const draft: TemplateDraftPayload = {
      name,
      notes,
      exerciseRows,
    };
    window.localStorage.setItem(
      getTemplateDraftStorageKey(userId, draftScope),
      JSON.stringify(draft),
    );
  }, [draftScope, exerciseRows, isChecking, name, notes, userId]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    clearMessage();

    const {
      data: { session },
    } = await supabaseBrowserClient.auth.getSession();
    if (!session?.access_token) {
      showError("You must be logged in to save a template.");
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      showError("Please enter a template name.");
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

    const exercises = exerciseRows.map((row) => {
      const parsedSets = row.targetSets ? Number(row.targetSets) : null;
      const parsedReps = row.targetReps ? Number(row.targetReps) : null;
      const parsedWeight = row.targetWeightKg ? Number(row.targetWeightKg) : null;
      const parsedBase = row.baseWeightKg ? Number(row.baseWeightKg) : null;
      return {
        exerciseId: row.exerciseId,
        targetSets: Number.isFinite(parsedSets) ? parsedSets : null,
        targetReps: Number.isFinite(parsedReps) ? parsedReps : null,
        targetWeightKg: Number.isFinite(parsedWeight) ? parsedWeight : null,
        baseWeightKg: Number.isFinite(parsedBase) ? parsedBase : null,
        notes: row.notes.trim() ? row.notes.trim() : null,
      };
    });

    setIsSaving(true);
    try {
      if (props.mode === "create") {
        await createUserTemplate({
          accessToken: session.access_token,
          name: trimmedName,
          notes: notes.trim() ? notes.trim() : null,
          exercises,
        });
      } else {
        await updateUserTemplate({
          accessToken: session.access_token,
          templateId: props.templateId,
          name: trimmedName,
          notes: notes.trim() ? notes.trim() : null,
          exercises,
        });
      }
      if (userId) {
        window.localStorage.removeItem(getTemplateDraftStorageKey(userId, draftScope));
      }
      router.push("/templates");
      router.refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Could not save template.");
    } finally {
      setIsSaving(false);
    }
  }

  function goBack() {
    clearMessage();
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/templates");
  }

  if (isChecking) {
    return (
      <PageShell className="items-center justify-center">
        <p className="text-sm text-zinc-600">Checking session...</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="flex items-center justify-between gap-3">
        <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <FileStack className="h-6 w-6 text-sky-700" />
          {title}
        </h1>
        <ActionButton type="button" onClick={goBack} variant="secondary" size="md">
          <ArrowLeft className="h-4 w-4 text-sky-700" />
          Back
        </ActionButton>
      </div>

      <p className="mt-2 text-sm text-zinc-600">
        Templates save exercise order, targets, and notes so you can start a workout session quickly.
        <Link
          href="/sessions/new"
          className="ml-1 font-medium text-sky-800 underline-offset-2 hover:underline"
        >
          Plan a session
        </Link>
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4 text-sm">
        <label className="block font-medium">
          Template name
          <span className="text-sky-700" aria-hidden>
            {" "}
            *
          </span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            placeholder="e.g. Upper body"
            maxLength={120}
          />
        </label>

        <label className="block font-medium">
          Template notes (optional)
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 h-24 w-full rounded-md border px-3 py-2 text-sm"
            maxLength={maxNotesLength}
            placeholder="Optional notes for this template"
          />
          <span className="mt-1 block text-xs text-zinc-500">
            {notes.length}/{maxNotesLength}
          </span>
        </label>

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

        <div className="flex flex-wrap justify-end gap-2">
          <ActionButton type="submit" variant="primary" size="md" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save template"}
          </ActionButton>
        </div>
      </form>
    </PageShell>
  );
}
