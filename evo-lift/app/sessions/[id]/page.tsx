"use client";

import { ArrowLeft, ChevronDown, ChevronUp, Dumbbell, Lock, LockOpen, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/database.types";

type SessionRow = Database["public"]["Tables"]["workout_sessions"]["Row"];
type SessionExerciseRow = Database["public"]["Tables"]["workout_session_exercises"]["Row"];
type WorkoutSetRow = Database["public"]["Tables"]["workout_sets"]["Row"];

type SetDraft = {
  reps: string;
  weightKg: string;
  isWarmup: boolean;
};

type AddExerciseDraft = {
  exerciseId: string;
  baseWeightKg: string;
  targetSets: string;
  targetReps: string;
  targetWeightKg: string;
  notes: string;
};

const emptyDraft: SetDraft = {
  reps: "",
  weightKg: "",
  isWarmup: false,
};

const emptyAddExerciseDraft: AddExerciseDraft = {
  exerciseId: "",
  baseWeightKg: "",
  targetSets: "",
  targetReps: "",
  targetWeightKg: "",
  notes: "",
};

export default function SessionDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const sessionId = params?.id;

  const [isChecking, setIsChecking] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [sessionExercises, setSessionExercises] = useState<SessionExerciseRow[]>([]);
  const [workoutSets, setWorkoutSets] = useState<WorkoutSetRow[]>([]);
  const [sessionNumber, setSessionNumber] = useState<number | null>(null);
  const [exerciseLabels, setExerciseLabels] = useState<Map<string, string>>(new Map());
  const [addDrafts, setAddDrafts] = useState<Record<string, SetDraft>>({});
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<SetDraft>(emptyDraft);
  const [isSavingSet, setIsSavingSet] = useState(false);
  const [isDeletingSession, setIsDeletingSession] = useState(false);
  const [isDeleteSessionConfirmOpen, setIsDeleteSessionConfirmOpen] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [hasHydratedReadOnly, setHasHydratedReadOnly] = useState(false);
  const [exerciseOptions, setExerciseOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [addExerciseDraft, setAddExerciseDraft] =
    useState<AddExerciseDraft>(emptyAddExerciseDraft);
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [isAddExerciseExpanded, setIsAddExerciseExpanded] = useState(false);

  function getReadOnlyStorageKey(currentSessionId: string) {
    return `evolift:session-readonly:${currentSessionId}`;
  }

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      const {
        data: { session: authSession },
      } = await supabaseBrowserClient.auth.getSession();

      if (!isMounted) {
        return;
      }
      if (!authSession || !sessionId) {
        router.replace("/login");
        return;
      }

      const { data: sessionData, error: sessionError } = await supabaseBrowserClient
        .from("workout_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (!isMounted) {
        return;
      }
      if (sessionError || !sessionData) {
        setMessage("Could not load workout session.");
        setIsChecking(false);
        return;
      }

      const { data: allUserSessions } = await supabaseBrowserClient
        .from("workout_sessions")
        .select("id")
        .eq("user_id", authSession.user.id)
        .order("created_at", { ascending: true });
      const computedSessionNumber =
        (allUserSessions ?? []).findIndex((row) => row.id === sessionData.id) + 1;

      const { data: sessionExerciseData, error: sessionExerciseError } =
        await supabaseBrowserClient
          .from("workout_session_exercises")
          .select("*")
          .eq("session_id", sessionId)
          .order("position", { ascending: true });

      if (!isMounted) {
        return;
      }
      if (sessionExerciseError) {
        setMessage("Could not load session exercises.");
        setIsChecking(false);
        return;
      }

      const sessionExerciseIds = (sessionExerciseData ?? []).map((row) => row.id);
      const exerciseIds = (sessionExerciseData ?? []).map((row) => row.exercise_id);

      let sets: WorkoutSetRow[] = [];
      if (sessionExerciseIds.length > 0) {
        const { data: setsData, error: setsError } = await supabaseBrowserClient
          .from("workout_sets")
          .select("*")
          .in("session_exercise_id", sessionExerciseIds)
          .order("set_number", { ascending: true });

        if (!isMounted) {
          return;
        }
        if (setsError) {
          setMessage("Could not load workout sets.");
          setIsChecking(false);
          return;
        }
        sets = setsData ?? [];
      }

      const labels = new Map<string, string>();
      const { data: allExercises, error: allExercisesError } = await supabaseBrowserClient
        .from("exercises")
        .select("id, slug")
        .order("slug", { ascending: true });
      if (allExercisesError) {
        setMessage("Could not load exercise options.");
        setIsChecking(false);
        return;
      }

      const allExerciseIds = (allExercises ?? []).map((row) => row.id);
      const { data: allTranslations } = await supabaseBrowserClient
        .from("exercise_translations")
        .select("exercise_id, name, lang_code")
        .in("exercise_id", allExerciseIds)
        .eq("lang_code", "en");

      const translated = new Map<string, string>();
      for (const item of allTranslations ?? []) {
        translated.set(item.exercise_id, item.name);
      }
      for (const item of allExercises ?? []) {
        labels.set(item.id, translated.get(item.id) ?? item.slug);
      }

      setSession(sessionData);
      setSessionNumber(computedSessionNumber > 0 ? computedSessionNumber : null);
      setSessionExercises(sessionExerciseData ?? []);
      setWorkoutSets(sets);
      setExerciseLabels(labels);
      setExerciseOptions(
        (allExercises ?? []).map((item) => ({
          id: item.id,
          label: translated.get(item.id) ?? item.slug,
        })),
      );
      setIsChecking(false);
    }

    void loadData();
    return () => {
      isMounted = false;
    };
  }, [router, sessionId]);

  useEffect(() => {
    if (isReadOnly) {
      setEditingSetId(null);
      setEditDraft(emptyDraft);
    }
  }, [isReadOnly]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    const stored = window.localStorage.getItem(getReadOnlyStorageKey(sessionId));
    setIsReadOnly(stored === "1");
    setHasHydratedReadOnly(true);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !hasHydratedReadOnly) {
      return;
    }
    window.localStorage.setItem(getReadOnlyStorageKey(sessionId), isReadOnly ? "1" : "0");
  }, [hasHydratedReadOnly, isReadOnly, sessionId]);

  function getSetsForExercise(sessionExerciseId: string) {
    return workoutSets
      .filter((set) => set.session_exercise_id === sessionExerciseId)
      .sort((a, b) => a.set_number - b.set_number);
  }

  function scrollExerciseToTop(sessionExerciseId: string) {
    const element = document.getElementById(`exercise-${sessionExerciseId}`);
    if (!element) {
      return;
    }
    const headerOffset = 72;
    const absoluteTop = window.scrollY + element.getBoundingClientRect().top;
    const targetTop = Math.max(0, absoluteTop - headerOffset);
    window.scrollTo({ top: targetTop, behavior: "smooth" });
  }

  function updateAddDraft(
    sessionExerciseId: string,
    key: keyof SetDraft,
    value: string | boolean,
  ) {
    setAddDrafts((prev) => ({
      ...prev,
      [sessionExerciseId]: {
        ...(prev[sessionExerciseId] ?? emptyDraft),
        [key]: value,
      },
    }));
  }

  async function handleAddSet(sessionExerciseId: string) {
    const draft = addDrafts[sessionExerciseId] ?? emptyDraft;
    const parsedReps = Number(draft.reps);
    if (!Number.isFinite(parsedReps) || parsedReps <= 0) {
      setMessage("Please enter a valid reps value.");
      return;
    }

    const existingSets = getSetsForExercise(sessionExerciseId);
    const nextSetNumber =
      existingSets.length > 0
        ? Math.max(...existingSets.map((set) => set.set_number)) + 1
        : 1;

    const parsedWeight = draft.weightKg ? Number(draft.weightKg) : null;
    if (parsedWeight !== null && (!Number.isFinite(parsedWeight) || parsedWeight < 0)) {
      setMessage("Please enter a valid weight.");
      return;
    }

    setIsSavingSet(true);
    setMessage(null);

    const { data, error } = await supabaseBrowserClient
      .from("workout_sets")
      .insert({
        session_exercise_id: sessionExerciseId,
        set_number: nextSetNumber,
        reps: parsedReps,
        weight_kg: parsedWeight,
        is_warmup: draft.isWarmup,
      })
      .select("*")
      .single();

    if (error || !data) {
      setMessage(`Could not add set: ${error?.message ?? "Unknown error"}`);
      setIsSavingSet(false);
      return;
    }

    setWorkoutSets((prev) => [...prev, data]);
    setAddDrafts((prev) => ({ ...prev, [sessionExerciseId]: emptyDraft }));
    setIsSavingSet(false);
  }

  function startEdit(set: WorkoutSetRow) {
    setEditingSetId(set.id);
    setEditDraft({
      reps: String(set.reps),
      weightKg: set.weight_kg == null ? "" : String(set.weight_kg),
      isWarmup: set.is_warmup,
    });
  }

  async function saveEdit(setId: string) {
    const parsedReps = Number(editDraft.reps);
    if (!Number.isFinite(parsedReps) || parsedReps <= 0) {
      setMessage("Please enter a valid reps value.");
      return;
    }
    const parsedWeight = editDraft.weightKg ? Number(editDraft.weightKg) : null;
    if (parsedWeight !== null && (!Number.isFinite(parsedWeight) || parsedWeight < 0)) {
      setMessage("Please enter a valid weight.");
      return;
    }

    setIsSavingSet(true);
    setMessage(null);

    const { data, error } = await supabaseBrowserClient
      .from("workout_sets")
      .update({
        reps: parsedReps,
        weight_kg: parsedWeight,
        is_warmup: editDraft.isWarmup,
      })
      .eq("id", setId)
      .select("*")
      .single();

    if (error || !data) {
      setMessage(`Could not update set: ${error?.message ?? "Unknown error"}`);
      setIsSavingSet(false);
      return;
    }

    setWorkoutSets((prev) => prev.map((item) => (item.id === setId ? data : item)));
    setEditingSetId(null);
    setEditDraft(emptyDraft);
    setIsSavingSet(false);
  }

  async function deleteSet(setId: string) {
    setIsSavingSet(true);
    setMessage(null);

    const { error } = await supabaseBrowserClient.from("workout_sets").delete().eq("id", setId);
    if (error) {
      setMessage(`Could not delete set: ${error.message}`);
      setIsSavingSet(false);
      return;
    }

    setWorkoutSets((prev) => prev.filter((set) => set.id !== setId));
    setIsSavingSet(false);
  }

  async function deleteSession() {
    if (!sessionId) {
      return;
    }
    setIsDeleteSessionConfirmOpen(false);
    setIsDeletingSession(true);
    setMessage(null);

    const sessionExerciseIds = sessionExercises.map((item) => item.id);
    if (sessionExerciseIds.length > 0) {
      const { error: setsDeleteError } = await supabaseBrowserClient
        .from("workout_sets")
        .delete()
        .in("session_exercise_id", sessionExerciseIds);
      if (setsDeleteError) {
        setMessage(`Could not delete workout sets: ${setsDeleteError.message}`);
        setIsDeletingSession(false);
        return;
      }

      const { error: sessionExercisesDeleteError } = await supabaseBrowserClient
        .from("workout_session_exercises")
        .delete()
        .eq("session_id", sessionId);
      if (sessionExercisesDeleteError) {
        setMessage(`Could not delete session exercises: ${sessionExercisesDeleteError.message}`);
        setIsDeletingSession(false);
        return;
      }
    }

    const { error: sessionDeleteError } = await supabaseBrowserClient
      .from("workout_sessions")
      .delete()
      .eq("id", sessionId);
    if (sessionDeleteError) {
      setMessage(`Could not delete workout session: ${sessionDeleteError.message}`);
      setIsDeletingSession(false);
      return;
    }

    router.replace("/");
  }

  async function addExerciseToSession() {
    if (!sessionId) {
      return;
    }
    if (!addExerciseDraft.exerciseId) {
      setMessage("Please choose an exercise to add.");
      return;
    }

    const alreadyInSession = sessionExercises.some(
      (row) => row.exercise_id === addExerciseDraft.exerciseId,
    );
    if (alreadyInSession) {
      setMessage("That exercise is already in this session.");
      return;
    }

    const parsedSets = addExerciseDraft.targetSets ? Number(addExerciseDraft.targetSets) : null;
    const parsedReps = addExerciseDraft.targetReps ? Number(addExerciseDraft.targetReps) : null;
    const parsedWeight = addExerciseDraft.targetWeightKg
      ? Number(addExerciseDraft.targetWeightKg)
      : null;
    const parsedBaseWeight = addExerciseDraft.baseWeightKg
      ? Number(addExerciseDraft.baseWeightKg)
      : null;

    if (parsedSets !== null && (!Number.isFinite(parsedSets) || parsedSets <= 0)) {
      setMessage("Please enter a valid target sets value.");
      return;
    }
    if (parsedReps !== null && (!Number.isFinite(parsedReps) || parsedReps <= 0)) {
      setMessage("Please enter a valid target reps value.");
      return;
    }
    if (parsedWeight !== null && (!Number.isFinite(parsedWeight) || parsedWeight < 0)) {
      setMessage("Please enter a valid target weight.");
      return;
    }
    if (parsedBaseWeight !== null && (!Number.isFinite(parsedBaseWeight) || parsedBaseWeight < 0)) {
      setMessage("Please enter a valid base weight.");
      return;
    }

    const nextPosition =
      sessionExercises.length > 0
        ? Math.max(...sessionExercises.map((row) => row.position)) + 1
        : 1;

    setIsAddingExercise(true);
    setMessage(null);

    const { data, error } = await supabaseBrowserClient
      .from("workout_session_exercises")
      .insert({
        session_id: sessionId,
        exercise_id: addExerciseDraft.exerciseId,
        position: nextPosition,
        base_weight_kg: parsedBaseWeight,
        target_sets: parsedSets,
        target_reps: parsedReps,
        target_weight_kg: parsedWeight,
        notes: addExerciseDraft.notes.trim() ? addExerciseDraft.notes.trim() : null,
      })
      .select("*")
      .single();

    if (error || !data) {
      setMessage(`Could not add exercise: ${error?.message ?? "Unknown error"}`);
      setIsAddingExercise(false);
      return;
    }

    setSessionExercises((prev) => [...prev, data].sort((a, b) => a.position - b.position));
    setAddExerciseDraft(emptyAddExerciseDraft);
    setIsAddingExercise(false);
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
        <p className="text-sm text-zinc-600">Loading workout session...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-12 sm:px-6 sm:py-16">
        <section className="panel p-5">
          <p className="text-sm text-red-600">{message ?? "Session not found."}</p>
        </section>
      </main>
    );
  }

  const formattedPerformedOn = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(`${session.performed_on}T00:00:00`));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-12 sm:px-6 sm:py-16">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Dumbbell className="h-6 w-6 text-amber-700" />
          Workout session #{sessionNumber ?? "-"} from {formattedPerformedOn}
        </h1>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {!isReadOnly ? (
            <>
              <button
                type="button"
                onClick={() => setIsDeleteSessionConfirmOpen(true)}
                disabled={isDeletingSession || isSavingSet}
                className="inline-flex w-fit items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:border-red-400 hover:bg-red-50 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {isDeletingSession ? "Deleting..." : "Delete"}
              </button>
              {isDeleteSessionConfirmOpen ? (
                <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-2 py-1">
                  <span className="text-xs text-red-800">
                    Delete session #{sessionNumber ?? "?"}?
                  </span>
                  <button
                    type="button"
                    onClick={deleteSession}
                    disabled={isDeletingSession}
                    className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-800 hover:border-red-500 hover:bg-red-100 disabled:opacity-60"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDeleteSessionConfirmOpen(false)}
                    disabled={isDeletingSession}
                    className="rounded-md border px-2 py-1 text-xs hover:bg-white disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
          <button
            type="button"
            onClick={() => setIsReadOnly((prev) => !prev)}
            className="inline-flex w-fit items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:border-amber-500 hover:bg-amber-100 hover:text-amber-700"
          >
            {isReadOnly ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {isReadOnly ? "Unlock" : "Lock"}
          </button>
          <button
            type="button"
            onClick={goBack}
            className="inline-flex w-fit items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:border-amber-500 hover:bg-amber-100 hover:text-amber-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>
      </div>
      <section className="panel p-5 text-sm">
        {session.notes?.trim() ? (
          <p>
            <span className="font-medium">Notes:</span> {session.notes}
          </p>
        ) : null}

        {sessionExercises.length === 0 ? (
          <section className="panel-nested panel-nested-odd mt-4 p-4 text-sm text-zinc-600">
            No exercises were added to this session.
          </section>
        ) : (
          <div className="mt-4 space-y-3">
            {sessionExercises.map((sessionExercise, index) => {
          const sets = getSetsForExercise(sessionExercise.id);
          const addDraft = addDrafts[sessionExercise.id] ?? emptyDraft;
          const exerciseLabel =
            exerciseLabels.get(sessionExercise.exercise_id) ?? sessionExercise.exercise_id;

          return (
            <section
              key={sessionExercise.id}
              id={`exercise-${sessionExercise.id}`}
              className={`panel panel-nested p-5 text-sm ${
                index % 2 === 0 ? "panel-nested-odd" : "panel-nested-even"
              }`}
            >
              <button
                type="button"
                onClick={() => scrollExerciseToTop(sessionExercise.id)}
                className="text-left text-lg font-medium"
                title="Scroll exercise to top"
              >
                {sessionExercise.position}. {exerciseLabel}
              </button>
              <p className="mt-1 text-zinc-600">
                Targets:{" "}
                {[
                  sessionExercise.base_weight_kg != null
                    ? `base ${sessionExercise.base_weight_kg} kg`
                    : null,
                  sessionExercise.target_sets ? `${sessionExercise.target_sets} sets` : null,
                  sessionExercise.target_reps ? `${sessionExercise.target_reps} reps` : null,
                  sessionExercise.target_weight_kg != null
                    ? `${sessionExercise.target_weight_kg} kg`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" | ") || "-"}
              </p>

              <div className="mt-3 space-y-3 md:hidden">
                {sets.map((set) =>
                  editingSetId === set.id ? (
                    <div key={set.id} className="rounded-md border border-zinc-300 bg-white p-3">
                      <p className="text-xs font-medium text-zinc-600">Set {set.set_number}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <label className="text-xs font-medium text-zinc-600">
                          Reps
                          <input
                            type="number"
                            min={1}
                            value={editDraft.reps}
                            onChange={(event) =>
                              setEditDraft((prev) => ({ ...prev, reps: event.target.value }))
                            }
                            className="mt-1 w-full rounded-md border bg-white px-2 py-1"
                          />
                        </label>
                        <label className="text-xs font-medium text-zinc-600">
                          Loaded (kg)
                          <input
                            type="number"
                            min={0}
                            step="0.5"
                            value={editDraft.weightKg}
                            onChange={(event) =>
                              setEditDraft((prev) => ({ ...prev, weightKg: event.target.value }))
                            }
                            className="mt-1 w-full rounded-md border bg-white px-2 py-1"
                          />
                        </label>
                      </div>
                      <label className="mt-2 inline-flex items-center gap-2 text-xs text-zinc-700">
                        <input
                          type="checkbox"
                          checked={editDraft.isWarmup}
                          onChange={(event) =>
                            setEditDraft((prev) => ({ ...prev, isWarmup: event.target.checked }))
                          }
                        />
                        Warmup
                      </label>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => saveEdit(set.id)}
                          disabled={isSavingSet}
                          className="rounded-md border px-2 py-1 text-xs"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSetId(null);
                            setEditDraft(emptyDraft);
                          }}
                          disabled={isSavingSet}
                          className="rounded-md border px-2 py-1 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div key={set.id} className="rounded-md border border-zinc-300 bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">Set {set.set_number}</p>
                        <p className="text-xs text-zinc-600">{set.is_warmup ? "Warmup" : "Working"}</p>
                      </div>
                      <p className="mt-1 text-sm">
                        <span className="font-medium">Reps:</span> {set.reps}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Loaded:</span> {set.weight_kg ?? "-"} kg
                      </p>
                      <p className="text-xs text-zinc-600">
                        Total: {((set.weight_kg ?? 0) + (sessionExercise.base_weight_kg ?? 0)).toFixed(1)} kg
                      </p>
                      {!isReadOnly ? (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(set)}
                            disabled={isSavingSet}
                            className="rounded-md border px-2 py-1 text-xs"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSet(set.id)}
                            disabled={isSavingSet}
                            className="rounded-md border px-2 py-1 text-xs"
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ),
                )}
                {!isReadOnly ? (
                  <div className="rounded-md border border-zinc-300 bg-white p-3">
                    <p className="inline-flex items-center gap-1 text-xs text-zinc-600">
                      <Plus className="h-3 w-3" />
                      New set
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="text-xs font-medium text-zinc-600">
                        Reps
                        <input
                          type="number"
                          min={1}
                          value={addDraft.reps}
                          onChange={(event) =>
                            updateAddDraft(sessionExercise.id, "reps", event.target.value)
                          }
                          className="mt-1 w-full rounded-md border bg-white px-2 py-1"
                          placeholder="Reps"
                        />
                      </label>
                      <label className="text-xs font-medium text-zinc-600">
                        Loaded (kg)
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          value={addDraft.weightKg}
                          onChange={(event) =>
                            updateAddDraft(sessionExercise.id, "weightKg", event.target.value)
                          }
                          className="mt-1 w-full rounded-md border bg-white px-2 py-1"
                          placeholder="Weight"
                        />
                      </label>
                    </div>
                    <label className="mt-2 inline-flex items-center gap-2 text-xs text-zinc-700">
                      <input
                        type="checkbox"
                        checked={addDraft.isWarmup}
                        onChange={(event) =>
                          updateAddDraft(sessionExercise.id, "isWarmup", event.target.checked)
                        }
                      />
                      Warmup
                    </label>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleAddSet(sessionExercise.id)}
                        disabled={isSavingSet}
                        className="rounded-md border px-2 py-1 text-xs"
                      >
                        Add set
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-3 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-2 py-2">Set</th>
                      <th className="px-2 py-2">Reps</th>
                      <th className="px-2 py-2">Loaded (kg)</th>
                      <th className="px-2 py-2">Warmup</th>
                      {!isReadOnly ? <th className="px-2 py-2">Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {sets.map((set) =>
                      editingSetId === set.id ? (
                        <tr key={set.id} className="border-b">
                          <td className="px-2 py-2">{set.set_number}</td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min={1}
                              value={editDraft.reps}
                              onChange={(event) =>
                                setEditDraft((prev) => ({ ...prev, reps: event.target.value }))
                              }
                              className="w-20 rounded-md border bg-white px-2 py-1"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min={0}
                              step="0.5"
                              value={editDraft.weightKg}
                              onChange={(event) =>
                                setEditDraft((prev) => ({ ...prev, weightKg: event.target.value }))
                              }
                              className="w-24 rounded-md border bg-white px-2 py-1"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="checkbox"
                              checked={editDraft.isWarmup}
                              onChange={(event) =>
                                setEditDraft((prev) => ({ ...prev, isWarmup: event.target.checked }))
                              }
                            />
                          </td>
                          {!isReadOnly ? (
                            <td className="px-2 py-2">
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => saveEdit(set.id)}
                                  disabled={isSavingSet}
                                  className="rounded-md border px-2 py-1 text-xs"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSetId(null);
                                    setEditDraft(emptyDraft);
                                  }}
                                  disabled={isSavingSet}
                                  className="rounded-md border px-2 py-1 text-xs"
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      ) : (
                        <tr key={set.id} className="border-b">
                          <td className="px-2 py-2">{set.set_number}</td>
                          <td className="px-2 py-2">{set.reps}</td>
                          <td className="px-2 py-2">
                            <div>{set.weight_kg ?? "-"}</div>
                            <div className="text-xs text-zinc-500">
                              Total: {((set.weight_kg ?? 0) + (sessionExercise.base_weight_kg ?? 0)).toFixed(1)} kg
                            </div>
                          </td>
                          <td className="px-2 py-2">{set.is_warmup ? "Yes" : "No"}</td>
                          {!isReadOnly ? (
                            <td className="px-2 py-2">
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => startEdit(set)}
                                  disabled={isSavingSet}
                                  className="rounded-md border px-2 py-1 text-xs"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteSet(set.id)}
                                  disabled={isSavingSet}
                                  className="rounded-md border px-2 py-1 text-xs"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      ),
                    )}
                    {!isReadOnly ? (
                      <tr>
                        <td className="px-2 py-2">
                          <span className="inline-flex items-center gap-1 text-xs text-zinc-600">
                            <Plus className="h-3 w-3" />
                            New
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min={1}
                            value={addDraft.reps}
                            onChange={(event) =>
                              updateAddDraft(sessionExercise.id, "reps", event.target.value)
                            }
                            className="w-20 rounded-md border bg-white px-2 py-1"
                            placeholder="Reps"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min={0}
                            step="0.5"
                            value={addDraft.weightKg}
                            onChange={(event) =>
                              updateAddDraft(sessionExercise.id, "weightKg", event.target.value)
                            }
                            className="w-24 rounded-md border bg-white px-2 py-1"
                            placeholder="Weight"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={addDraft.isWarmup}
                            onChange={(event) =>
                              updateAddDraft(sessionExercise.id, "isWarmup", event.target.checked)
                            }
                          />
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleAddSet(sessionExercise.id)}
                              disabled={isSavingSet}
                              className="rounded-md border px-2 py-1 text-xs"
                            >
                              Add set
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          );
            })}
          </div>
        )}

        {!isReadOnly ? (
          <section className="panel panel-nested panel-nested-even mt-4 p-5 text-sm">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAddExerciseExpanded((prev) => !prev)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-amber-100 hover:text-amber-700"
                aria-label={isAddExerciseExpanded ? "Collapse add exercise section" : "Expand add exercise section"}
              >
                {isAddExerciseExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsAddExerciseExpanded((prev) => !prev)}
                className="text-base font-medium hover:text-amber-700"
              >
                Add exercise to this session
              </button>
            </div>
            {isAddExerciseExpanded ? (
              <>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium sm:col-span-2">
                    Exercise
                    <select
                      value={addExerciseDraft.exerciseId}
                      onChange={(event) =>
                        setAddExerciseDraft((prev) => ({ ...prev, exerciseId: event.target.value }))
                      }
                      className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Select exercise</option>
                      {exerciseOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-medium">
                    Base weight (kg)
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      value={addExerciseDraft.baseWeightKg}
                      onChange={(event) =>
                        setAddExerciseDraft((prev) => ({ ...prev, baseWeightKg: event.target.value }))
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
                            setAddExerciseDraft((prev) => ({
                              ...prev,
                              baseWeightKg: value === 0 ? "" : String(value),
                            }))
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
                      value={addExerciseDraft.targetSets}
                      onChange={(event) =>
                        setAddExerciseDraft((prev) => ({ ...prev, targetSets: event.target.value }))
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
                      value={addExerciseDraft.targetReps}
                      onChange={(event) =>
                        setAddExerciseDraft((prev) => ({ ...prev, targetReps: event.target.value }))
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
                      value={addExerciseDraft.targetWeightKg}
                      onChange={(event) =>
                        setAddExerciseDraft((prev) => ({
                          ...prev,
                          targetWeightKg: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                      placeholder="e.g. 60"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Notes (optional)
                    <input
                      type="text"
                      value={addExerciseDraft.notes}
                      onChange={(event) =>
                        setAddExerciseDraft((prev) => ({ ...prev, notes: event.target.value }))
                      }
                      className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                      placeholder="Optional exercise notes"
                    />
                  </label>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={addExerciseToSession}
                    disabled={isAddingExercise}
                    className="inline-flex h-10 items-center justify-center gap-1 rounded-md border px-3 py-2 text-sm hover:border-amber-500 hover:bg-amber-100 hover:text-amber-700 disabled:opacity-60"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {isAddingExercise ? "Adding..." : "Add exercise"}
                  </button>
                </div>
              </>
            ) : null}
          </section>
        ) : null}
      </section>

      {message ? <section className="panel p-4 text-sm text-red-600">{message}</section> : null}
    </main>
  );
}
