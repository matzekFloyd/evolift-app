"use client";

import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ListChecks,
  Lock,
  LockOpen,
  History,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/database.types";
import { ActionButton } from "@/app/components/action-button";
import { CompactStickyBar } from "@/app/components/compact-sticky-bar";
import { CompactRowActions } from "@/app/components/compact-row-actions";
import { SetKindIndicator } from "@/app/components/set-kind-indicator";
import { DateInput } from "@/app/components/date-input";
import { ExerciseSearchSelect } from "@/app/components/exercise-search-select";
import { NotesTextareaField } from "@/app/components/notes-textarea-field";
import { PageShell } from "@/app/components/page-shell";
import { StatusNotice } from "@/app/components/status-notice";
import { formatDateOnlyForLocale } from "@/lib/date-format";
import { toExerciseBadge } from "@/lib/exercise-badge";
import { exerciseOptionsForPicker } from "@/lib/exercise-picker-options";
import { loadExerciseMetadata } from "@/lib/exercise-metadata-cache";
import { createPageLoadPerfTracker } from "@/lib/page-load-perf";
import { isFutureSessionDate } from "@/lib/session-date";

type SessionRow = Database["public"]["Tables"]["workout_sessions"]["Row"];
type SessionExerciseRow = Database["public"]["Tables"]["workout_session_exercises"]["Row"];
type WorkoutSetRow = Database["public"]["Tables"]["workout_sets"]["Row"];
type SessionNumberCountRow = {
  id: string;
};

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

type MessageTone = "error" | "warning" | "success";

const maxSessionNotesLength = 500;

/** Validates `YYYY-MM-DD` and calendar day (e.g. rejects 2024-02-31). */
function parseYyyyMmDdDateOnly(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }
  const [year, month, day] = trimmed.split("-").map(Number);
  const constructed = new Date(year, month - 1, day);
  if (
    constructed.getFullYear() !== year ||
    constructed.getMonth() !== month - 1 ||
    constructed.getDate() !== day
  ) {
    return null;
  }
  return trimmed;
}

const emptyDraft: SetDraft = {
  reps: "",
  weightKg: "",
  isWarmup: false,
};

/** Most recent working (non-warmup) set in `set_number` order. */
function findLastWorkingSet(setsSorted: WorkoutSetRow[]): WorkoutSetRow | null {
  for (let i = setsSorted.length - 1; i >= 0; i -= 1) {
    const row = setsSorted[i];
    if (row && !row.is_warmup) {
      return row;
    }
  }
  return null;
}

/** Session exercise targets only; omit fields not set on the row (no guesses). */
function targetPrefillStringsFromSessionExercise(
  sessionExercise: SessionExerciseRow,
): { reps: string; weightKg: string } {
  const reps =
    sessionExercise.target_reps != null &&
    sessionExercise.target_reps > 0 &&
    Number.isFinite(sessionExercise.target_reps)
      ? String(sessionExercise.target_reps)
      : "";
  const weightKg =
    sessionExercise.target_weight_kg != null &&
    Number.isFinite(Number(sessionExercise.target_weight_kg))
      ? String(sessionExercise.target_weight_kg)
      : "";
  return { reps, weightKg };
}

/**
 * Add-set defaults: targets when no working set exists yet; otherwise last working set.
 * Warmup rows never supply weight/reps for the next row. `partialDraft` preserves user edits.
 * When set 1 is working, the next set copies from that row (last working), not stale targets alone.
 */
function resolveSuggestedAddDraft(
  sessionExercise: SessionExerciseRow | undefined,
  setsSorted: WorkoutSetRow[],
  partialDraft: Partial<SetDraft> | undefined,
): SetDraft {
  const lastWorking = findLastWorkingSet(setsSorted);
  const targets = sessionExercise
    ? targetPrefillStringsFromSessionExercise(sessionExercise)
    : { reps: "", weightKg: "" };

  const reps =
    partialDraft?.reps !== undefined
      ? partialDraft.reps
      : lastWorking
        ? String(lastWorking.reps)
        : targets.reps;
  const weightKg =
    partialDraft?.weightKg !== undefined
      ? partialDraft.weightKg
      : lastWorking
        ? lastWorking.weight_kg == null
          ? ""
          : String(lastWorking.weight_kg)
        : targets.weightKg;
  const isWarmup =
    partialDraft?.isWarmup !== undefined ? partialDraft.isWarmup : false;

  return { reps, weightKg, isWarmup };
}

const emptyAddExerciseDraft: AddExerciseDraft = {
  exerciseId: "",
  baseWeightKg: "",
  targetSets: "",
  targetReps: "",
  targetWeightKg: "",
  notes: "",
};

/** Query param: `workout_session_exercises.id` for deep-link + reload restore. */
const SESSION_DETAIL_EXERCISE_QUERY = "ex";

function replaceSessionDetailQuery(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  searchParams: { toString: () => string },
  mutator: (params: URLSearchParams) => void,
) {
  const params = new URLSearchParams(searchParams.toString());
  mutator(params);
  const qs = params.toString();
  router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
}

export default function SessionDetailPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const sessionId = params?.id;

  const [isChecking, setIsChecking] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<MessageTone>("error");
  const [session, setSession] = useState<SessionRow | null>(null);
  const [sessionExercises, setSessionExercises] = useState<SessionExerciseRow[]>([]);
  const [workoutSets, setWorkoutSets] = useState<WorkoutSetRow[]>([]);
  const [sessionNumber, setSessionNumber] = useState<number | null>(null);
  const [exerciseLabels, setExerciseLabels] = useState<Map<string, string>>(new Map());
  const [addDrafts, setAddDrafts] = useState<Record<string, Partial<SetDraft>>>({});
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<SetDraft>(emptyDraft);
  const [isSavingSet, setIsSavingSet] = useState(false);
  const [isDeletingSession, setIsDeletingSession] = useState(false);
  const [isDeleteSessionConfirmOpen, setIsDeleteSessionConfirmOpen] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [hasHydratedReadOnly, setHasHydratedReadOnly] = useState(false);
  const [exerciseOptions, setExerciseOptions] = useState<Array<{ id: string; label: string; slug: string }>>([]);
  const [addExerciseDraft, setAddExerciseDraft] =
    useState<AddExerciseDraft>(emptyAddExerciseDraft);
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [isAddExerciseExpanded, setIsAddExerciseExpanded] = useState(false);
  const [isAddExerciseSheetOpen, setIsAddExerciseSheetOpen] = useState(false);
  const [isTargetsSheetOpen, setIsTargetsSheetOpen] = useState(false);
  const [targetsSets, setTargetsSets] = useState("");
  const [targetsReps, setTargetsReps] = useState("");
  const [targetsWeightKg, setTargetsWeightKg] = useState("");
  const [targetsSessionExerciseId, setTargetsSessionExerciseId] = useState<string | null>(null);
  const [isSavingTargets, setIsSavingTargets] = useState(false);
  const [isSmallPhone, setIsSmallPhone] = useState(false);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const activeExerciseIndexChangeSourceRef = useRef<"user" | "url">("user");
  /** Tracks `workout_session_exercises.id` for the active row to clear global notices on exercise change (#72). */
  const lastActiveSessionExerciseIdRef = useRef<string | null>(null);
  /** Compact add-exercise jumps to the new row in the same tick as success; keep that toast once. */
  const skipNextClearMessageOnExerciseIdChangeRef = useRef(false);
  const lastSessionExerciseIdsKeyRef = useRef<string>("");
  const [hiddenExerciseIds, setHiddenExerciseIds] = useState<Set<string>>(new Set());
  /** Compact single-exercise flow: show full new-set composer after target working sets are met. */
  const [compactShowExtraSetComposer, setCompactShowExtraSetComposer] = useState(false);
  /** Full (md+) table: session_exercise ids where the add-set row stays open past target. */
  const [fullViewExpandAddSetRowIds, setFullViewExpandAddSetRowIds] = useState<Set<string>>(
    () => new Set(),
  );
  const maxExerciseNotesLength = 500;
  const [performedOnDraft, setPerformedOnDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [sessionDetailsDateError, setSessionDetailsDateError] = useState<string | null>(null);
  const [sessionDetailsNotesError, setSessionDetailsNotesError] = useState<string | null>(null);
  const [isSavingSessionDetails, setIsSavingSessionDetails] = useState(false);
  const [isEditingSessionDetails, setIsEditingSessionDetails] = useState(false);

  const addExercisePickerOptions = useMemo(
    () =>
      exerciseOptionsForPicker(
        exerciseOptions,
        hiddenExerciseIds,
        addExerciseDraft.exerciseId,
      ),
    [exerciseOptions, hiddenExerciseIds, addExerciseDraft.exerciseId],
  );

  const sessionDetailsDirty = useMemo(() => {
    if (!session) {
      return false;
    }
    if (performedOnDraft !== session.performed_on) {
      return true;
    }
    const draftTrim = notesDraft.trim();
    const sessionTrim = (session.notes ?? "").trim();
    return draftTrim !== sessionTrim;
  }, [session, performedOnDraft, notesDraft]);

  function showError(messageText: string) {
    setMessageTone("error");
    setMessage(messageText);
  }

  function showWarning(messageText: string) {
    setMessageTone("warning");
    setMessage(messageText);
  }

  function showSuccess(messageText: string) {
    setMessageTone("success");
    setMessage(messageText);
  }

  const clearMessage = useCallback(() => {
    setMessage(null);
  }, []);

  function getExerciseLabelForSessionExerciseId(sessionExerciseId: string): string {
    const sessionExercise = sessionExercises.find((item) => item.id === sessionExerciseId);
    if (!sessionExercise) {
      return "exercise";
    }
    return exerciseLabels.get(sessionExercise.exercise_id) ?? sessionExercise.exercise_id;
  }

  function getReadOnlyStorageKey(currentSessionId: string) {
    return `evolift:session-readonly:${currentSessionId}`;
  }

  useEffect(() => {
    let isMounted = true;
    const perf = createPageLoadPerfTracker("/sessions/[id]");

    async function loadData() {
      const {
        data: { session: authSession },
      } = await perf.trackQuery("auth.getSession", () => supabaseBrowserClient.auth.getSession());

      if (!isMounted) {
        return;
      }
      if (!authSession || !sessionId) {
        router.replace("/login");
        return;
      }

      const { data: sessionData, error: sessionError } = await perf.trackQuery(
        "workout_sessions.selectById",
        () =>
          supabaseBrowserClient
            .from("workout_sessions")
            .select("id, user_id, performed_on, notes, created_at, updated_at")
            .eq("id", sessionId)
            .single(),
      );

      if (!isMounted) {
        return;
      }
      if (sessionError || !sessionData) {
        showError("Could not load workout session.");
        setIsChecking(false);
        perf.flush();
        return;
      }

      if (sessionData.user_id !== authSession.user.id) {
        showError("You do not have access to this workout session.");
        setIsChecking(false);
        perf.flush();
        return;
      }

      // Compute session number without loading full user session history.
      const { count: priorSessionsCount, error: priorCountError } = await perf.trackQuery(
        "workout_sessions.countPriorByCreatedAt",
        () =>
          supabaseBrowserClient
            .from("workout_sessions")
            .select("id", { count: "exact", head: true })
            .eq("user_id", authSession.user.id)
            .lt("created_at", sessionData.created_at),
      );
      if (priorCountError) {
        showError("Could not compute session number.");
        setIsChecking(false);
        perf.flush();
        return;
      }

      const { data: sameCreatedAtRows, error: sameCreatedAtError } = await perf.trackQuery(
        "workout_sessions.selectSameCreatedAtIds",
        () =>
          supabaseBrowserClient
            .from("workout_sessions")
            .select("id")
            .eq("user_id", authSession.user.id)
            .eq("created_at", sessionData.created_at)
            .order("id", { ascending: true }),
      );
      if (sameCreatedAtError) {
        showError("Could not compute session number.");
        setIsChecking(false);
        perf.flush();
        return;
      }

      const typedSameCreatedAtRows = (sameCreatedAtRows ?? []) as SessionNumberCountRow[];
      const sameCreatedAtIndex = typedSameCreatedAtRows.findIndex((row) => row.id === sessionData.id);
      const computedSessionNumber =
        (priorSessionsCount ?? 0) + (sameCreatedAtIndex >= 0 ? sameCreatedAtIndex + 1 : 1);

      const { data: sessionExerciseData, error: sessionExerciseError } = await perf.trackQuery(
        "workout_session_exercises.selectBySessionId",
        () =>
          supabaseBrowserClient
            .from("workout_session_exercises")
            .select("*")
            .eq("session_id", sessionId)
            .order("position", { ascending: true }),
      );

      if (!isMounted) {
        return;
      }
      if (sessionExerciseError) {
        showError("Could not load session exercises.");
        setIsChecking(false);
        perf.flush();
        return;
      }

      const sessionExerciseIds = (sessionExerciseData ?? []).map((row) => row.id);
      let sets: WorkoutSetRow[] = [];
      if (sessionExerciseIds.length > 0) {
        const { data: setsData, error: setsError } = await perf.trackQuery(
          "workout_sets.selectBySessionExerciseIds",
          () =>
            supabaseBrowserClient
              .from("workout_sets")
              .select("*")
              .in("session_exercise_id", sessionExerciseIds)
              .order("set_number", { ascending: true }),
        );

        if (!isMounted) {
          return;
        }
        if (setsError) {
          showError("Could not load workout sets.");
          setIsChecking(false);
          perf.flush();
          return;
        }
        sets = setsData ?? [];
      }

      const labels = new Map<string, string>();
      let allExercises: Array<{ id: string; slug: string; label: string }> = [];
      try {
        allExercises = await perf.trackQuery("exerciseMetadata.load", () =>
          loadExerciseMetadata(supabaseBrowserClient, { ttlMs: 5 * 60 * 1000 }),
        );
      } catch (error) {
        showError(error instanceof Error ? error.message : "Could not load exercise options.");
        setIsChecking(false);
        perf.flush();
        return;
      }
      for (const item of allExercises) {
        labels.set(item.id, item.label);
      }

      const { data: hiddenRows, error: hiddenError } = await perf.trackQuery(
        "user_hidden_exercises.selectByUserId",
        () =>
          supabaseBrowserClient
            .from("user_hidden_exercises")
            .select("exercise_id")
            .eq("user_id", authSession.user.id),
      );

      if (!isMounted) {
        return;
      }
      if (hiddenError) {
        showError("Could not load exercise visibility.");
        setIsChecking(false);
        perf.flush();
        return;
      }

      const hiddenSet = new Set<string>();
      for (const row of hiddenRows ?? []) {
        hiddenSet.add(row.exercise_id);
      }

      setSession(sessionData);
      setPerformedOnDraft(sessionData.performed_on);
      setNotesDraft(sessionData.notes ?? "");
      setSessionDetailsDateError(null);
      setSessionDetailsNotesError(null);
      setSessionNumber(computedSessionNumber > 0 ? computedSessionNumber : null);
      setSessionExercises(sessionExerciseData ?? []);
      setWorkoutSets(sets);
      setExerciseLabels(labels);
      setExerciseOptions(
        allExercises.map((item) => ({
          id: item.id,
          label: item.label,
          slug: item.slug,
        })),
      );
      setHiddenExerciseIds(hiddenSet);
      setIsChecking(false);
      perf.flush();
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
      setIsEditingSessionDetails(false);
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

  useEffect(() => {
    lastSessionExerciseIdsKeyRef.current = "";
  }, [sessionId]);

  useEffect(() => {
    setFullViewExpandAddSetRowIds(new Set());
  }, [sessionId]);

  useEffect(() => {
    setFullViewExpandAddSetRowIds((prev) => {
      if (prev.size === 0) {
        return prev;
      }
      const next = new Set<string>();
      for (const id of prev) {
        const ex = sessionExercises.find((e) => e.id === id);
        if (!ex) {
          continue;
        }
        const goal = ex.target_sets;
        const workingCount = workoutSets.filter(
          (s) => s.session_exercise_id === id && !s.is_warmup,
        ).length;
        const met = goal != null && goal > 0 && workingCount >= goal;
        if (met) {
          next.add(id);
        }
      }
      return next.size === prev.size ? prev : next;
    });
  }, [sessionExercises, workoutSets]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsSmallPhone(mediaQuery.matches);
    apply();
    const onChange = () => apply();
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    setCompactShowExtraSetComposer(false);
  }, [activeExerciseIndex]);

  useEffect(() => {
    if (!isSmallPhone || isReadOnly) {
      return;
    }
    const ex = sessionExercises[activeExerciseIndex];
    if (!ex) {
      return;
    }
    const goal = ex.target_sets;
    const workingCount = workoutSets.filter(
      (s) => s.session_exercise_id === ex.id && !s.is_warmup,
    ).length;
    const met = goal != null && goal > 0 && workingCount >= goal;
    if (!met) {
      setCompactShowExtraSetComposer(false);
    }
  }, [isSmallPhone, isReadOnly, sessionExercises, activeExerciseIndex, workoutSets]);

  useEffect(() => {
    if (activeExerciseIndex >= sessionExercises.length) {
      setActiveExerciseIndex(Math.max(0, sessionExercises.length - 1));
    }
  }, [activeExerciseIndex, sessionExercises.length]);

  useEffect(() => {
    lastActiveSessionExerciseIdRef.current = null;
    skipNextClearMessageOnExerciseIdChangeRef.current = false;
  }, [sessionId]);

  /** Global StatusNotice (message): clear when the active session exercise changes (#72). Session header field errors stay on their controls. */
  useEffect(() => {
    if (isChecking) {
      return;
    }
    if (activeExerciseIndex < 0 || activeExerciseIndex >= sessionExercises.length) {
      return;
    }
    const id = sessionExercises[activeExerciseIndex]?.id;
    if (!id) {
      return;
    }
    const prev = lastActiveSessionExerciseIdRef.current;
    if (skipNextClearMessageOnExerciseIdChangeRef.current) {
      skipNextClearMessageOnExerciseIdChangeRef.current = false;
      lastActiveSessionExerciseIdRef.current = id;
      return;
    }
    if (prev !== null && id !== prev) {
      clearMessage();
    }
    lastActiveSessionExerciseIdRef.current = id;
  }, [activeExerciseIndex, sessionExercises, isChecking, clearMessage]);

  useEffect(() => {
    if (isChecking || !sessionId || session?.id !== sessionId) {
      return;
    }

    const idsKey = sessionExercises.map((e) => e.id).join(",");
    const ex = searchParams.get(SESSION_DETAIL_EXERCISE_QUERY);

    if (sessionExercises.length === 0) {
      if (ex) {
        replaceSessionDetailQuery(router, pathname, searchParams, (params) => {
          params.delete(SESSION_DETAIL_EXERCISE_QUERY);
        });
      }
      activeExerciseIndexChangeSourceRef.current = "url";
      setActiveExerciseIndex(0);
      lastSessionExerciseIdsKeyRef.current = idsKey;
      return;
    }

    const listChanged = lastSessionExerciseIdsKeyRef.current !== idsKey;
    lastSessionExerciseIdsKeyRef.current = idsKey;

    if (listChanged) {
      if (ex) {
        const idx = sessionExercises.findIndex((e) => e.id === ex);
        if (idx < 0) {
          activeExerciseIndexChangeSourceRef.current = "url";
          setActiveExerciseIndex(0);
          replaceSessionDetailQuery(router, pathname, searchParams, (params) => {
            params.delete(SESSION_DETAIL_EXERCISE_QUERY);
          });
        } else {
          activeExerciseIndexChangeSourceRef.current = "url";
          setActiveExerciseIndex(idx);
        }
      }
      return;
    }

    if (ex) {
      const idx = sessionExercises.findIndex((e) => e.id === ex);
      if (idx >= 0) {
        activeExerciseIndexChangeSourceRef.current = "url";
        setActiveExerciseIndex(idx);
      } else {
        activeExerciseIndexChangeSourceRef.current = "url";
        setActiveExerciseIndex(0);
        replaceSessionDetailQuery(router, pathname, searchParams, (params) => {
          params.delete(SESSION_DETAIL_EXERCISE_QUERY);
        });
      }
    } else {
      activeExerciseIndexChangeSourceRef.current = "url";
      setActiveExerciseIndex(0);
    }
  }, [isChecking, pathname, router, searchParams, session?.id, sessionExercises, sessionId]);

  useEffect(() => {
    if (isChecking || !sessionId || session?.id !== sessionId || sessionExercises.length === 0) {
      return;
    }
    if (activeExerciseIndexChangeSourceRef.current === "url") {
      activeExerciseIndexChangeSourceRef.current = "user";
      return;
    }

    const id = sessionExercises[activeExerciseIndex]?.id;
    if (!id) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    const cur = params.get(SESSION_DETAIL_EXERCISE_QUERY);

    if (activeExerciseIndex === 0) {
      if (!cur) {
        return;
      }
      params.delete(SESSION_DETAIL_EXERCISE_QUERY);
    } else {
      if (cur === id) {
        return;
      }
      params.set(SESSION_DETAIL_EXERCISE_QUERY, id);
    }

    const qs = params.toString();
    if (qs === searchParams.toString()) {
      return;
    }
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [
    activeExerciseIndex,
    isChecking,
    pathname,
    router,
    searchParams,
    session?.id,
    sessionExercises,
    sessionId,
  ]);

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
        ...prev[sessionExerciseId],
        [key]: value,
      },
    }));
  }

  function getLastSet(sessionExerciseId: string): WorkoutSetRow | null {
    const sets = getSetsForExercise(sessionExerciseId);
    if (sets.length === 0) {
      return null;
    }
    return sets[sets.length - 1] ?? null;
  }

  function getResolvedAddDraft(sessionExerciseId: string): SetDraft {
    const sessionExercise = sessionExercises.find((e) => e.id === sessionExerciseId);
    return resolveSuggestedAddDraft(
      sessionExercise,
      getSetsForExercise(sessionExerciseId),
      addDrafts[sessionExerciseId],
    );
  }

  async function handleAddSet(sessionExerciseId: string) {
    if (session && isFutureSessionDate(session.performed_on)) {
      showWarning("Planned workouts cannot have sets yet. Log sets on or after the session date.");
      return;
    }
    const draft = getResolvedAddDraft(sessionExerciseId);
    const parsedReps = Number(draft.reps);
    if (!Number.isFinite(parsedReps) || parsedReps <= 0) {
      showError("Please enter a valid reps value.");
      return;
    }

    const existingSets = getSetsForExercise(sessionExerciseId);
    const nextSetNumber =
      existingSets.length > 0
        ? Math.max(...existingSets.map((set) => set.set_number)) + 1
        : 1;

    const parsedWeight = draft.weightKg ? Number(draft.weightKg) : null;
    if (parsedWeight !== null && (!Number.isFinite(parsedWeight) || parsedWeight < 0)) {
      showError("Please enter a valid weight.");
      return;
    }

    setIsSavingSet(true);

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
      showError(`Could not add set: ${error?.message ?? "Unknown error"}`);
      setIsSavingSet(false);
      return;
    }

    setWorkoutSets((prev) => [...prev, data]);
    const sessionExercise = sessionExercises.find((e) => e.id === sessionExerciseId);
    const mergedForExercise = [...getSetsForExercise(sessionExerciseId), data].sort(
      (a, b) => a.set_number - b.set_number,
    );
    const nextSuggested = resolveSuggestedAddDraft(sessionExercise, mergedForExercise, undefined);
    setAddDrafts((prev) => ({
      ...prev,
      [sessionExerciseId]: nextSuggested,
    }));
    const exerciseLabel = getExerciseLabelForSessionExerciseId(sessionExerciseId);
    showSuccess(`Set ${data.set_number} added for ${exerciseLabel}.`);
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
      showError("Please enter a valid reps value.");
      return;
    }
    const parsedWeight = editDraft.weightKg ? Number(editDraft.weightKg) : null;
    if (parsedWeight !== null && (!Number.isFinite(parsedWeight) || parsedWeight < 0)) {
      showError("Please enter a valid weight.");
      return;
    }

    setIsSavingSet(true);

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
      showError(`Could not update set: ${error?.message ?? "Unknown error"}`);
      setIsSavingSet(false);
      return;
    }

    const previousSet = workoutSets.find((item) => item.id === setId);
    const exerciseLabel = previousSet
      ? getExerciseLabelForSessionExerciseId(previousSet.session_exercise_id)
      : "exercise";
    setWorkoutSets((prev) => prev.map((item) => (item.id === setId ? data : item)));
    setEditingSetId(null);
    setEditDraft(emptyDraft);
    showSuccess(`Set ${data.set_number} updated for ${exerciseLabel}.`);
    setIsSavingSet(false);
  }

  async function deleteSet(setId: string) {
    setIsSavingSet(true);

    const deletedSet = workoutSets.find((set) => set.id === setId);
    const { error } = await supabaseBrowserClient.from("workout_sets").delete().eq("id", setId);
    if (error) {
      showError(`Could not delete set: ${error.message}`);
      setIsSavingSet(false);
      return;
    }

    setWorkoutSets((prev) => prev.filter((set) => set.id !== setId));
    if (deletedSet) {
      const sessionExerciseId = deletedSet.session_exercise_id;
      const setsBefore = workoutSets
        .filter((s) => s.session_exercise_id === sessionExerciseId)
        .sort((a, b) => a.set_number - b.set_number);
      const setsAfter = setsBefore.filter((s) => s.id !== setId);
      const sessionExercise = sessionExercises.find((e) => e.id === sessionExerciseId);
      const autoBefore = resolveSuggestedAddDraft(sessionExercise, setsBefore, undefined);
      const autoAfter = resolveSuggestedAddDraft(sessionExercise, setsAfter, undefined);
      const addDefaultsChanged =
        autoBefore.reps !== autoAfter.reps ||
        autoBefore.weightKg !== autoAfter.weightKg ||
        autoBefore.isWarmup !== autoAfter.isWarmup;

      if (addDefaultsChanged) {
        setAddDrafts((prev) => {
          const next = { ...prev };
          delete next[sessionExerciseId];
          return next;
        });
      }

      const exerciseLabel = getExerciseLabelForSessionExerciseId(sessionExerciseId);
      showSuccess(`Set ${deletedSet.set_number} deleted from ${exerciseLabel}.`);
    } else {
      showSuccess("Set deleted.");
    }
    setIsSavingSet(false);
  }

  async function deleteSession() {
    if (!sessionId) {
      return;
    }
    setIsDeleteSessionConfirmOpen(false);
    setIsDeletingSession(true);
    clearMessage();

    const sessionExerciseIds = sessionExercises.map((item) => item.id);
    if (sessionExerciseIds.length > 0) {
      const { error: setsDeleteError } = await supabaseBrowserClient
        .from("workout_sets")
        .delete()
        .in("session_exercise_id", sessionExerciseIds);
      if (setsDeleteError) {
        showError(`Could not delete workout sets: ${setsDeleteError.message}`);
        setIsDeletingSession(false);
        return;
      }

      const { error: sessionExercisesDeleteError } = await supabaseBrowserClient
        .from("workout_session_exercises")
        .delete()
        .eq("session_id", sessionId);
      if (sessionExercisesDeleteError) {
        showError(`Could not delete session exercises: ${sessionExercisesDeleteError.message}`);
        setIsDeletingSession(false);
        return;
      }
    }

    const { error: sessionDeleteError } = await supabaseBrowserClient
      .from("workout_sessions")
      .delete()
      .eq("id", sessionId);
    if (sessionDeleteError) {
      showError(`Could not delete workout session: ${sessionDeleteError.message}`);
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
      showError("Please choose an exercise to add.");
      return;
    }

    const alreadyInSession = sessionExercises.some(
      (row) => row.exercise_id === addExerciseDraft.exerciseId,
    );
    if (alreadyInSession) {
      showWarning("That exercise is already in this session.");
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
      showError("Please enter a valid number of target working sets.");
      return;
    }
    if (parsedReps !== null && (!Number.isFinite(parsedReps) || parsedReps <= 0)) {
      showError("Please enter a valid target reps value for working sets.");
      return;
    }
    if (parsedWeight !== null && (!Number.isFinite(parsedWeight) || parsedWeight < 0)) {
      showError("Please enter a valid target weight (kg) for working sets.");
      return;
    }
    if (parsedBaseWeight !== null && (!Number.isFinite(parsedBaseWeight) || parsedBaseWeight < 0)) {
      showError("Please enter a valid base weight.");
      return;
    }

    const nextPosition =
      sessionExercises.length > 0
        ? Math.max(...sessionExercises.map((row) => row.position)) + 1
        : 1;

    setIsAddingExercise(true);

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
      showError(`Could not add exercise: ${error?.message ?? "Unknown error"}`);
      setIsAddingExercise(false);
      return;
    }

    setSessionExercises((prev) => [...prev, data].sort((a, b) => a.position - b.position));
    if (isCompactView) {
      skipNextClearMessageOnExerciseIdChangeRef.current = true;
      setActiveExerciseIndex(sessionExercises.length);
      setIsAddExerciseSheetOpen(false);
    }
    showSuccess("Exercise added to session.");
    setAddExerciseDraft(emptyAddExerciseDraft);
    setIsAddingExercise(false);
  }

  function startTargetsEdit(sessionExercise: SessionExerciseRow, mode: "inline" | "sheet") {
    setTargetsSessionExerciseId(sessionExercise.id);
    setTargetsSets(sessionExercise.target_sets == null ? "" : String(sessionExercise.target_sets));
    setTargetsReps(sessionExercise.target_reps == null ? "" : String(sessionExercise.target_reps));
    setTargetsWeightKg(
      sessionExercise.target_weight_kg == null ? "" : String(sessionExercise.target_weight_kg),
    );
    setIsTargetsSheetOpen(mode === "sheet");
  }

  function cancelTargetsEdit() {
    setIsTargetsSheetOpen(false);
    setTargetsSessionExerciseId(null);
  }

  async function saveTargetsForExercise() {
    if (!targetsSessionExerciseId) {
      showError("Could not determine which exercise targets to update.");
      return;
    }

    const parsedSets = targetsSets ? Number(targetsSets) : null;
    const parsedReps = targetsReps ? Number(targetsReps) : null;
    const parsedWeight = targetsWeightKg ? Number(targetsWeightKg) : null;

    if (parsedSets !== null && (!Number.isFinite(parsedSets) || parsedSets <= 0)) {
      showError("Please enter a valid number of target working sets.");
      return;
    }
    if (parsedReps !== null && (!Number.isFinite(parsedReps) || parsedReps <= 0)) {
      showError("Please enter a valid target reps value for working sets.");
      return;
    }
    if (parsedWeight !== null && (!Number.isFinite(parsedWeight) || parsedWeight < 0)) {
      showError("Please enter a valid target weight (kg) for working sets.");
      return;
    }

    setIsSavingTargets(true);

    const { data, error } = await supabaseBrowserClient
      .from("workout_session_exercises")
      .update({
        target_sets: parsedSets,
        target_reps: parsedReps,
        target_weight_kg: parsedWeight,
      })
      .eq("id", targetsSessionExerciseId)
      .select("*")
      .single();

    if (error || !data) {
      showError(`Could not update targets: ${error?.message ?? "Unknown error"}`);
      setIsSavingTargets(false);
      return;
    }

    setSessionExercises((prev) =>
      prev.map((item) => (item.id === targetsSessionExerciseId ? data : item)),
    );
    setIsSavingTargets(false);
    setIsTargetsSheetOpen(false);
    setTargetsSessionExerciseId(null);
    const updatedExerciseLabel =
      targetsSessionExerciseId != null
        ? getExerciseLabelForSessionExerciseId(targetsSessionExerciseId)
        : "exercise";
    showSuccess(`Targets updated for ${updatedExerciseLabel}.`);
  }

  function beginEditingSessionDetails() {
    if (!session) {
      return;
    }
    setPerformedOnDraft(session.performed_on);
    setNotesDraft(session.notes ?? "");
    setSessionDetailsDateError(null);
    setSessionDetailsNotesError(null);
    setIsEditingSessionDetails(true);
  }

  function cancelEditingSessionDetails() {
    if (!session) {
      setIsEditingSessionDetails(false);
      return;
    }
    setPerformedOnDraft(session.performed_on);
    setNotesDraft(session.notes ?? "");
    setSessionDetailsDateError(null);
    setSessionDetailsNotesError(null);
    setIsEditingSessionDetails(false);
  }

  async function saveSessionDetails() {
    if (!sessionId || !session) {
      return;
    }

    setSessionDetailsDateError(null);
    setSessionDetailsNotesError(null);

    const dateTrimmed = performedOnDraft.trim();
    if (!dateTrimmed) {
      setSessionDetailsDateError("Please choose a performed date.");
      return;
    }
    const parsedDate = parseYyyyMmDdDateOnly(dateTrimmed);
    if (!parsedDate) {
      setSessionDetailsDateError("Please enter a valid performed date (YYYY-MM-DD).");
      return;
    }

    if (workoutSets.length > 0 && isFutureSessionDate(parsedDate)) {
      setSessionDetailsDateError(
        "This session already has logged sets. Choose today or an earlier date.",
      );
      return;
    }

    if (notesDraft.length > maxSessionNotesLength) {
      setSessionDetailsNotesError(
        `Session notes cannot be longer than ${maxSessionNotesLength} characters.`,
      );
      return;
    }

    const notesTrimmed = notesDraft.trim();
    const notesPayload = notesTrimmed.length > 0 ? notesTrimmed : null;

    setIsSavingSessionDetails(true);
    clearMessage();

    const { data, error } = await supabaseBrowserClient
      .from("workout_sessions")
      .update({
        performed_on: parsedDate,
        notes: notesPayload,
      })
      .eq("id", sessionId)
      .select("id, user_id, performed_on, notes, created_at, updated_at")
      .single();

    if (error || !data) {
      const msg = error?.message ?? "Unknown error";
      if (/row level security|rls|permission denied|violates row-level/i.test(msg)) {
        showError("You can only update your own workout sessions.");
      } else {
        showError(`Could not update session: ${msg}`);
      }
      setIsSavingSessionDetails(false);
      return;
    }

    setSession(data);
    setPerformedOnDraft(data.performed_on);
    setNotesDraft(data.notes ?? "");
    setIsEditingSessionDetails(false);
    showSuccess("Session date and notes saved.");
    setIsSavingSessionDetails(false);
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
        <p className="text-sm text-zinc-600">Loading workout session...</p>
      </PageShell>
    );
  }

  if (!session) {
    return (
      <PageShell>
        <section className="panel p-5">
          <p className="text-sm text-red-600">{message ?? "Session not found."}</p>
        </section>
      </PageShell>
    );
  }

  const formattedPerformedOn = formatDateOnlyForLocale(session.performed_on);
  const isPlannedSession = isFutureSessionDate(session.performed_on);
  const canManageSets = !isReadOnly && !isPlannedSession;

  const isCompactView = isSmallPhone;
  const shouldUseSingleExerciseFlow = isCompactView && !isReadOnly;
  const exerciseBadgeById = new Map<string, string>();
  const exerciseSlugById = new Map<string, string>();
  for (const option of exerciseOptions) {
    exerciseBadgeById.set(option.id, toExerciseBadge(option.slug));
    exerciseSlugById.set(option.id, option.slug);
  }
  const visibleExercises = shouldUseSingleExerciseFlow
    ? sessionExercises
        .map((item, index) => ({ item, index }))
        .filter(({ index }) => index === activeExerciseIndex)
    : sessionExercises.map((item, index) => ({ item, index }));
  const activeSessionExercise =
    sessionExercises.length > 0 ? (sessionExercises[activeExerciseIndex] ?? sessionExercises[0]) : null;
  const activeExerciseLabel =
    activeSessionExercise
      ? (exerciseLabels.get(activeSessionExercise.exercise_id) ?? activeSessionExercise.exercise_id)
      : "";
  const targetsExerciseLabel = (() => {
    if (!targetsSessionExerciseId) {
      return activeExerciseLabel;
    }
    const selected = sessionExercises.find((item) => item.id === targetsSessionExerciseId);
    if (!selected) {
      return activeExerciseLabel;
    }
    return exerciseLabels.get(selected.exercise_id) ?? selected.exercise_id;
  })();

  const activeWorkingSetCount =
    activeSessionExercise == null
      ? 0
      : workoutSets.filter(
          (s) => s.session_exercise_id === activeSessionExercise.id && !s.is_warmup,
        ).length;
  const activeTargetSetsGoal = activeSessionExercise?.target_sets ?? null;
  const activeTargetSetsMet =
    activeTargetSetsGoal != null &&
    activeTargetSetsGoal > 0 &&
    activeWorkingSetCount >= activeTargetSetsGoal;
  const stickyHideAddSetButton =
    shouldUseSingleExerciseFlow &&
    canManageSets &&
    activeTargetSetsMet &&
    !compactShowExtraSetComposer;
  const stickyNextLabel =
    stickyHideAddSetButton && activeExerciseIndex < sessionExercises.length - 1
      ? "Next exercise"
      : "Next";

  return (
    <PageShell
      className={
        isCompactView
          ? "max-md:!pb-[calc(11rem+env(safe-area-inset-bottom,0px))]"
          : undefined
      }
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {isCompactView ? (
          <div className="flex w-full items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight">
                Workout session #{sessionNumber ?? "-"}
              </h1>
              <p className="mt-0.5 inline-flex items-center gap-2 text-sm text-zinc-500">
                <span>{formattedPerformedOn}</span>
                {isPlannedSession ? (
                  <span className="rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-700">
                    Planned
                  </span>
                ) : null}
              </p>
            </div>
            <button
              type="button"
              onClick={goBack}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-800 hover:border-sky-300 hover:bg-zinc-100"
            >
              <ArrowLeft className="h-4 w-4 text-sky-700" />
              Back
            </button>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Workout session #{sessionNumber ?? "-"}</h1>
            <p className="mt-0.5 inline-flex items-center gap-2 text-sm text-zinc-500">
              <span>{formattedPerformedOn}</span>
              {isPlannedSession ? (
                <span className="rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-700">
                  Planned
                </span>
              ) : null}
            </p>
          </div>
        )}
        <div
          className={`flex flex-wrap items-center gap-2 lg:justify-end ${
            isCompactView ? "w-full" : ""
          }`}
        >
          {!isReadOnly ? (
            <>
              <button
                type="button"
                onClick={() => setIsDeleteSessionConfirmOpen(true)}
                disabled={isDeletingSession || isSavingSet}
                className={`inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-800 hover:border-sky-400 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-60 ${
                  isCompactView ? "h-10 flex-1 justify-center" : "w-fit"
                }`}
              >
                <Trash2 className="h-4 w-4 text-red-600" />
                {isDeletingSession ? "Deleting..." : "Delete session"}
              </button>
              {isDeleteSessionConfirmOpen ? (
                <div
                  className={`flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 ${
                    isCompactView ? "w-full flex-wrap justify-center" : ""
                  }`}
                >
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
              onClick={() => {
                clearMessage();
                setIsReadOnly((prev) => !prev);
              }}
            className={
              isCompactView
                ? "inline-flex h-10 flex-1 items-center justify-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-800 hover:border-sky-400 hover:bg-zinc-100 hover:text-zinc-900"
                : "inline-flex w-fit items-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-800 hover:border-sky-400 hover:bg-zinc-100 hover:text-zinc-900"
            }
          >
            {isReadOnly ? (
              <LockOpen className="h-4 w-4 text-sky-700" />
            ) : (
              <Lock className="h-4 w-4 text-sky-700" />
            )}
            {isReadOnly ? "Unlock" : "Lock"}
          </button>
          {!isCompactView ? (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex w-fit items-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-800 hover:border-sky-400 hover:bg-zinc-100 hover:text-zinc-900"
            >
              <ArrowLeft className="h-4 w-4 text-sky-700" />
              Back
            </button>
          ) : null}
        </div>
      </div>
      <section className="text-sm">
        {isReadOnly && session.notes?.trim() ? (
          <p className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <span className="font-medium">Notes:</span> {session.notes}
          </p>
        ) : null}
        {!isReadOnly ? (
          <div className="mt-3 space-y-3 rounded-md border border-zinc-200 bg-zinc-50/80 p-4">
            {!isEditingSessionDetails ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-700">Performed on</p>
                    <p className="mt-0.5 tabular-nums text-zinc-900">{formattedPerformedOn}</p>
                  </div>
                  <div className="flex shrink-0 justify-end">
                    <button
                      type="button"
                      onClick={beginEditingSessionDetails}
                      disabled={isSavingSessionDetails || isDeletingSession}
                      className="inline-flex h-8 w-[72px] items-center justify-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-800 hover:border-sky-300 hover:bg-zinc-100 disabled:opacity-60 sm:w-20"
                    >
                      <Pencil className="h-3 w-3 text-sky-700" aria-hidden />
                      Edit
                    </button>
                  </div>
                </div>
                <div className="text-sm">
                  <p className="font-medium text-zinc-700">Notes</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-zinc-900">
                    {session.notes?.trim() ? (
                      session.notes
                    ) : (
                      <span className="text-zinc-500">None</span>
                    )}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor="session-performed-on-edit"
                      className="mb-1 inline-flex items-center gap-1 text-sm font-medium text-zinc-800"
                    >
                      <CalendarDays className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
                      Performed on
                    </label>
                    <DateInput
                      id="session-performed-on-edit"
                      value={performedOnDraft}
                      onChange={(event) => {
                        setPerformedOnDraft(event.target.value);
                        setSessionDetailsDateError(null);
                      }}
                      className="block w-full max-w-[11rem] rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm md:max-w-xs"
                    />
                    {sessionDetailsDateError ? (
                      <p className="mt-1 text-sm text-red-600" role="alert">
                        {sessionDetailsDateError}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 self-end md:flex-row md:justify-end md:self-start">
                    <button
                      type="button"
                      onClick={() => void saveSessionDetails()}
                      disabled={
                        !sessionDetailsDirty || isSavingSessionDetails || isDeletingSession
                      }
                      className="inline-flex w-24 items-center justify-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 hover:border-sky-300 hover:bg-zinc-50 disabled:opacity-60"
                    >
                      <Check className="h-3 w-3 text-emerald-600" aria-hidden />
                      {isSavingSessionDetails ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditingSessionDetails}
                      disabled={isSavingSessionDetails}
                      className="inline-flex w-24 items-center justify-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 hover:border-sky-300 hover:bg-zinc-50 disabled:opacity-60"
                    >
                      <X className="h-3 w-3 text-zinc-500" aria-hidden />
                      Cancel
                    </button>
                  </div>
                </div>
                <div>
                  <NotesTextareaField
                    label="Session notes (optional)"
                    value={notesDraft}
                    onChange={(next) => {
                      setNotesDraft(next);
                      setSessionDetailsNotesError(null);
                    }}
                    placeholder="Optional notes for this workout"
                    maxLength={maxSessionNotesLength}
                    heightClassName="h-28"
                  />
                  {sessionDetailsNotesError ? (
                    <p className="mt-1 text-sm text-red-600" role="alert">
                      {sessionDetailsNotesError}
                    </p>
                  ) : null}
                </div>
              </>
            )}
          </div>
        ) : null}
        {message ? (
          <StatusNotice message={message} tone={messageTone} onDismiss={clearMessage} className="mt-3" />
        ) : null}

        {sessionExercises.length === 0 ? (
          <section className="panel-nested panel-nested-odd mt-4 p-4 text-sm text-zinc-600">
            No exercises were added to this session.
          </section>
        ) : (
          <div className="mt-4 space-y-3">
            {visibleExercises.map(({ item: sessionExercise, index }) => {
          const sets = getSetsForExercise(sessionExercise.id);
          const addDraft = getResolvedAddDraft(sessionExercise.id);
          const lastSet = getLastSet(sessionExercise.id);
          const exerciseLabel =
            exerciseLabels.get(sessionExercise.exercise_id) ?? sessionExercise.exercise_id;
          const exerciseBadge = exerciseBadgeById.get(sessionExercise.exercise_id);
          const exerciseSlug = exerciseSlugById.get(sessionExercise.exercise_id);
          const targetParts = [
            sessionExercise.target_sets ? `${sessionExercise.target_sets} working sets` : null,
            sessionExercise.target_weight_kg != null ? `${sessionExercise.target_weight_kg} kg` : null,
            sessionExercise.target_reps ? `${sessionExercise.target_reps} reps` : null,
          ].filter(Boolean) as string[];

          const workingSetCount = sets.filter((set) => !set.is_warmup).length;
          const targetSetsGoal = sessionExercise.target_sets;
          const targetSetsMet =
            targetSetsGoal != null &&
            targetSetsGoal > 0 &&
            workingSetCount >= targetSetsGoal;
          const hideCompactNewSetComposer =
            shouldUseSingleExerciseFlow &&
            targetSetsMet &&
            canManageSets &&
            !compactShowExtraSetComposer;
          const hideFullViewAddSetRow =
            targetSetsMet &&
            canManageSets &&
            !fullViewExpandAddSetRowIds.has(sessionExercise.id);
          /** Mobile compact: soft sky emphasis on the add-set card while still working toward target sets. */
          const compactNewSetPanelHighlight = isCompactView && !targetSetsMet;

          const exercisePanelClass = shouldUseSingleExerciseFlow
            ? "min-h-[calc(100vh-24rem)] p-1 text-sm"
            : `rounded-xl border p-5 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.05)] ${
                targetSetsMet
                  ? "border-sky-200/90 bg-sky-50/40"
                  : "border-zinc-200 bg-zinc-50/80"
              }`;

          return (
            <section
              key={sessionExercise.id}
              id={`exercise-${sessionExercise.id}`}
              className={exercisePanelClass}
            >
              <div className="flex w-full items-start justify-between gap-3 text-left">
                {exerciseSlug ? (
                  <Link
                    href={`/exercises/${exerciseSlug}`}
                    className="group inline-flex min-w-0 items-center gap-2 truncate rounded-sm text-lg font-medium text-zinc-900 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
                  >
                    {exerciseBadge ? (
                      <span className="inline-flex h-6 min-w-8 shrink-0 items-center justify-center rounded border border-zinc-300 bg-zinc-50 px-1 text-[10px] font-semibold tracking-wide text-zinc-700 transition-colors group-hover:border-sky-300 group-hover:text-sky-800">
                        {exerciseBadge}
                      </span>
                    ) : null}
                    <span className="truncate underline-offset-2 hover:underline">{exerciseLabel}</span>
                  </Link>
                ) : (
                  <span className="inline-flex min-w-0 items-center gap-2 truncate text-lg font-medium text-zinc-900">
                    {exerciseBadge ? (
                      <span className="inline-flex h-6 min-w-8 shrink-0 items-center justify-center rounded border border-zinc-300 bg-zinc-50 px-1 text-[10px] font-semibold tracking-wide text-zinc-700">
                        {exerciseBadge}
                      </span>
                    ) : null}
                    <span className="truncate">{exerciseLabel}</span>
                  </span>
                )}
                <span className="shrink-0 text-xs text-zinc-500">
                  {index + 1}/{sessionExercises.length}
                </span>
              </div>
              <div className="mt-2 flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium text-zinc-600">Targets:</span>
                  {targetParts.length > 0 ? (
                    targetParts.map((part) => (
                      <span
                        key={`${sessionExercise.id}-${part}`}
                        className="inline-flex items-center rounded-full border border-zinc-300 bg-white px-2 py-0.5 text-xs text-zinc-700"
                      >
                        {part}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-zinc-500">none set</span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {exerciseSlug ? (
                    <Link
                      href={`/exercises/${exerciseSlug}`}
                      className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-2 text-xs text-zinc-800 hover:border-sky-300 hover:bg-zinc-100"
                    >
                      <History className="h-3.5 w-3.5 text-sky-700" />
                      Open history
                    </Link>
                  ) : null}
                  {!isReadOnly && !shouldUseSingleExerciseFlow ? (
                    <button
                      type="button"
                      onClick={() => {
                        const isOpenForThisExercise =
                          targetsSessionExerciseId === sessionExercise.id && !isTargetsSheetOpen;
                        if (isOpenForThisExercise) {
                          cancelTargetsEdit();
                          return;
                        }
                        startTargetsEdit(sessionExercise, "inline");
                      }}
                      title="Edit planned working-set targets (warmups do not count)."
                      className="inline-flex h-9 w-24 items-center justify-center rounded-md border border-zinc-300 bg-zinc-50 px-2 text-xs text-zinc-800 hover:border-sky-300 hover:bg-zinc-100"
                    >
                      {targetsSessionExerciseId === sessionExercise.id && !isTargetsSheetOpen ? (
                        <ChevronUp className="mr-1 h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="mr-1 h-3.5 w-3.5" />
                      )}
                      Set targets
                    </button>
                  ) : null}
                </div>
              </div>
              {!shouldUseSingleExerciseFlow && targetsSessionExerciseId === sessionExercise.id ? (
                <div className="mt-3 rounded-md border border-zinc-200 bg-white p-3">
                  <p className="mb-3 text-xs text-zinc-600">
                    Values apply to working sets only; warmups do not count.
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <label className="block text-sm font-medium">
                      Target working sets
                      <input
                        type="number"
                        min={1}
                        value={targetsSets}
                        onChange={(event) => setTargetsSets(event.target.value)}
                        className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                        placeholder="e.g. 3"
                      />
                    </label>
                    <label className="block text-sm font-medium">
                      Target weight (kg)
                      <input
                        type="number"
                        min={0}
                        step="0.25"
                        value={targetsWeightKg}
                        onChange={(event) => setTargetsWeightKg(event.target.value)}
                        className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                        placeholder="e.g. 60"
                      />
                    </label>
                    <label className="block text-sm font-medium">
                      Target reps (working sets)
                      <input
                        type="number"
                        min={1}
                        value={targetsReps}
                        onChange={(event) => setTargetsReps(event.target.value)}
                        className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                        placeholder="e.g. 8"
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={cancelTargetsEdit}
                      className="inline-flex h-9 w-24 items-center justify-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-2 text-xs text-zinc-800 hover:border-sky-300 hover:bg-zinc-100"
                    >
                      <X className="h-3 w-3 text-zinc-500" />
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => saveTargetsForExercise()}
                      disabled={isSavingTargets}
                      className="inline-flex h-9 w-24 items-center justify-center gap-1 rounded-md border border-sky-700 bg-sky-700 px-2 text-xs text-white hover:border-sky-600 hover:bg-sky-600 disabled:opacity-60"
                    >
                      <Check className="h-3 w-3 text-white" />
                      {isSavingTargets ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="mt-3 space-y-3 md:hidden">
                {sets.map((set) =>
                  editingSetId === set.id ? (
                    <div key={set.id} className="rounded-md border border-zinc-200 bg-zinc-50/80 p-3 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                      <p className="text-xs font-medium text-zinc-600">Set {set.set_number}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <label className="text-xs font-medium text-zinc-600">
                          Loaded (kg)
                          <input
                            type="number"
                            min={0}
                            step="0.25"
                            value={editDraft.weightKg}
                            onChange={(event) =>
                              setEditDraft((prev) => ({ ...prev, weightKg: event.target.value }))
                            }
                            className="mt-1 w-full rounded-md border bg-white px-2 py-1"
                          />
                        </label>
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
                      </div>
                      <label className="mt-2 inline-flex items-center gap-2 text-xs text-zinc-700">
                        <input
                          type="checkbox"
                          checked={editDraft.isWarmup}
                          onChange={(event) =>
                            setEditDraft((prev) => ({ ...prev, isWarmup: event.target.checked }))
                          }
                        />
                        Warmup?
                      </label>
                      <div className="mt-3 flex justify-end gap-2">
                        <CompactRowActions
                          isEditing
                          onEdit={() => {}}
                          onSave={() => saveEdit(set.id)}
                          onCancel={() => {
                            setEditingSetId(null);
                            setEditDraft(emptyDraft);
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div key={set.id} className="rounded-md border border-zinc-200 bg-zinc-50/80 p-3 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                      {isCompactView ? (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 text-sm text-zinc-700">
                              <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
                                <span className="inline-flex flex-wrap items-center gap-1.5">
                                  <SetKindIndicator isWarmup={set.is_warmup} density="compact" />
                                  <span className="font-medium text-zinc-900">Set {set.set_number}</span>
                                </span>
                                <span className="text-zinc-500">·</span>
                                <span>
                                  {set.weight_kg ?? "-"} kg, {set.reps} reps
                                </span>
                              </span>
                            </div>
                            {canManageSets ? (
                              <div className="flex shrink-0 items-center">
                                <CompactRowActions
                                  isEditing={false}
                                  onEdit={() => startEdit(set)}
                                  onSave={() => {}}
                                  onCancel={() => {}}
                                  onSecondary={() => deleteSet(set.id)}
                                  secondaryLabel="Delete"
                                />
                              </div>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <p className="inline-flex flex-wrap items-center gap-2 text-sm font-medium">
                              <SetKindIndicator isWarmup={set.is_warmup} density="default" />
                              <span>Set {set.set_number}</span>
                            </p>
                          </div>
                          <p className="mt-1 text-sm">
                            <span className="font-medium">Loaded:</span> {set.weight_kg ?? "-"} kg
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">Reps:</span> {set.reps}
                          </p>
                          <p className="text-xs text-zinc-600">
                            Total: {((set.weight_kg ?? 0) + (sessionExercise.base_weight_kg ?? 0)).toFixed(1)} kg
                          </p>
                          {canManageSets ? (
                            <div className="mt-3 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => deleteSet(set.id)}
                                disabled={isSavingSet}
                                className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-800 hover:border-sky-300 hover:bg-zinc-100"
                              >
                                <Trash2 className="h-3 w-3 text-red-600" />
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => startEdit(set)}
                                disabled={isSavingSet}
                                className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-800 hover:border-sky-300 hover:bg-zinc-100"
                              >
                                <Pencil className="h-3 w-3 text-sky-700" />
                                Edit
                              </button>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  ),
                )}
                {canManageSets ? (
                  hideCompactNewSetComposer ? (
                    <div className="rounded-md border border-sky-200 bg-sky-50/70 p-3 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                      <p className="text-sm font-medium text-sky-950">All target working sets logged.</p>
                      {index < sessionExercises.length - 1 ? (
                        <ActionButton
                          type="button"
                          variant="primary"
                          fullWidth
                          className="mt-2"
                          onClick={() =>
                            setActiveExerciseIndex((prev) =>
                              Math.min(sessionExercises.length - 1, prev + 1),
                            )
                          }
                        >
                          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                          Next exercise
                        </ActionButton>
                      ) : (
                        <>
                          <p className="mt-2 text-xs text-zinc-600">
                            Last exercise in this session. Add another exercise when you are ready, or finish
                            logging.
                          </p>
                          <ActionButton
                            type="button"
                            variant="primary"
                            fullWidth
                            className="mt-2"
                            onClick={() => setIsAddExerciseSheetOpen(true)}
                          >
                            <Plus className="h-4 w-4 shrink-0" aria-hidden />
                            Add exercise
                          </ActionButton>
                        </>
                      )}
                      <ActionButton
                        type="button"
                        variant="secondary"
                        size="sm"
                        fullWidth
                        className="mt-2"
                        title="Show the add-set form to log more sets."
                        onClick={() => setCompactShowExtraSetComposer(true)}
                      >
                        <Plus className="h-4 w-4 shrink-0" aria-hidden />
                        Add more sets
                      </ActionButton>
                    </div>
                  ) : (
                    <div
                      className={
                        compactNewSetPanelHighlight
                          ? "rounded-md border border-sky-200 bg-sky-50/55 p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                          : "rounded-md border border-zinc-200 bg-zinc-50/80 p-3 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                      }
                    >
                      <p
                        className={
                          compactNewSetPanelHighlight
                            ? "inline-flex items-center gap-1 text-sm font-medium text-sky-950"
                            : "inline-flex items-center gap-1 text-sm text-zinc-700"
                        }
                      >
                        <Plus className="h-3 w-3 text-sky-700" aria-hidden />
                        New set
                      </p>
                      {lastSet ? (
                        <p className="mt-2 text-[11px] text-zinc-500">
                          <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            <SetKindIndicator isWarmup={lastSet.is_warmup} density="compact" />
                            <span>
                              Last set: {lastSet.weight_kg ?? 0} kg × {lastSet.reps} reps
                            </span>
                          </span>
                        </p>
                      ) : null}
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <label className="text-sm font-medium text-zinc-700">
                          Loaded (kg)
                          <input
                            type="number"
                            min={0}
                            step="0.25"
                            value={addDraft.weightKg}
                            onChange={(event) =>
                              updateAddDraft(sessionExercise.id, "weightKg", event.target.value)
                            }
                            className="mt-1 w-full rounded-md border bg-white px-2 py-1"
                            placeholder="Weight"
                          />
                          <div className="mt-1 flex gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                updateAddDraft(
                                  sessionExercise.id,
                                  "weightKg",
                                  String(Math.max(0, Number((Number(addDraft.weightKg || "0") - 2.5).toFixed(1)))),
                                )
                              }
                              className="rounded border px-2 py-0.5 text-xs"
                            >
                              -2.5
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateAddDraft(
                                  sessionExercise.id,
                                  "weightKg",
                                  String(Number((Number(addDraft.weightKg || "0") + 2.5).toFixed(1))),
                                )
                              }
                              className="rounded border px-2 py-0.5 text-xs"
                            >
                              +2.5
                            </button>
                          </div>
                        </label>
                        <label className="text-sm font-medium text-zinc-700">
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
                          <div className="mt-1 flex gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                updateAddDraft(
                                  sessionExercise.id,
                                  "reps",
                                  String(Math.max(1, Number(addDraft.reps || "1") - 1)),
                                )
                              }
                              className="rounded border px-2 py-0.5 text-xs"
                            >
                              -1
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateAddDraft(
                                  sessionExercise.id,
                                  "reps",
                                  String(Math.max(1, Number(addDraft.reps || "0") + 1)),
                                )
                              }
                              className="rounded border px-2 py-0.5 text-xs"
                            >
                              +1
                            </button>
                          </div>
                        </label>
                      </div>
                      <label className="mt-2 inline-flex items-center gap-2 text-sm text-zinc-700">
                        <input
                          type="checkbox"
                          checked={addDraft.isWarmup}
                          onChange={(event) =>
                            updateAddDraft(sessionExercise.id, "isWarmup", event.target.checked)
                          }
                        />
                        Warmup?
                      </label>
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleAddSet(sessionExercise.id)}
                          disabled={isSavingSet || isPlannedSession}
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm"
                        >
                          <Plus className="h-3.5 w-3.5 text-sky-700" />
                          Add set
                        </button>
                      </div>
                    </div>
                  )
                ) : null}
              </div>

              {!isPlannedSession ? (
                <div className="mt-3 hidden overflow-x-auto rounded-md border border-zinc-200 bg-white md:block">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b bg-zinc-50">
                      <th className="px-2 py-2">Type</th>
                      <th className="px-2 py-2">Set</th>
                      <th className="px-2 py-2">Loaded (kg)</th>
                      <th className="px-2 py-2">Reps</th>
                      {canManageSets ? <th className="px-2 py-2 text-right">Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {sets.map((set) =>
                      editingSetId === set.id ? (
                        <tr key={set.id} className="border-b bg-white">
                          <td className="px-2 py-2">
                            <label className="inline-flex cursor-pointer items-center gap-2 text-zinc-800">
                              <input
                                type="checkbox"
                                checked={editDraft.isWarmup}
                                onChange={(event) =>
                                  setEditDraft((prev) => ({ ...prev, isWarmup: event.target.checked }))
                                }
                                className="rounded border-zinc-300 text-sky-700 focus:ring-sky-600"
                              />
                              <span className="text-xs">Warmup?</span>
                            </label>
                          </td>
                          <td className="px-2 py-2">{set.set_number}</td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min={0}
                              step="0.25"
                              value={editDraft.weightKg}
                              onChange={(event) =>
                                setEditDraft((prev) => ({ ...prev, weightKg: event.target.value }))
                              }
                              className="w-24 rounded-md border bg-white px-2 py-1"
                            />
                          </td>
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
                          {canManageSets ? (
                            <td className="px-2 py-2">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => saveEdit(set.id)}
                                  disabled={isSavingSet}
                                  className="inline-flex w-24 items-center justify-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-800 hover:border-sky-300 hover:bg-zinc-100"
                                >
                                  <Check className="h-3 w-3 text-emerald-600" />
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSetId(null);
                                    setEditDraft(emptyDraft);
                                  }}
                                  disabled={isSavingSet}
                                  className="inline-flex w-24 items-center justify-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-800 hover:border-sky-300 hover:bg-zinc-100"
                                >
                                  <X className="h-3 w-3 text-zinc-500" />
                                  Cancel
                                </button>
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      ) : (
                        <tr key={set.id} className="border-b odd:bg-white even:bg-zinc-50/60 hover:bg-zinc-100/60">
                          <td className="px-2 py-2">
                            <SetKindIndicator isWarmup={set.is_warmup} density="compact" />
                          </td>
                          <td className="px-2 py-2">{set.set_number}</td>
                          <td className="px-2 py-2">
                            <div>{set.weight_kg ?? "-"}</div>
                            <div className="text-xs text-zinc-500">
                              Total: {((set.weight_kg ?? 0) + (sessionExercise.base_weight_kg ?? 0)).toFixed(1)} kg
                            </div>
                          </td>
                          <td className="px-2 py-2">{set.reps}</td>
                          {canManageSets ? (
                            <td className="px-2 py-2">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => deleteSet(set.id)}
                                  disabled={isSavingSet}
                                  className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-800 hover:border-sky-300 hover:bg-zinc-100"
                                >
                                  <Trash2 className="h-3 w-3 text-red-600" />
                                  Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startEdit(set)}
                                  disabled={isSavingSet}
                                  className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-800 hover:border-sky-300 hover:bg-zinc-100"
                                >
                                  <Pencil className="h-3 w-3 text-sky-700" />
                                  Edit
                                </button>
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      ),
                    )}
                    {canManageSets && hideFullViewAddSetRow ? (
                      <tr className="border-b bg-sky-50/50">
                        <td colSpan={5} className="px-2 py-2">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-950">
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-sky-700" aria-hidden />
                              All target working sets logged.
                            </span>
                            <ActionButton
                              type="button"
                              variant="secondary"
                              size="sm"
                              title="Show the add-set row to log more sets."
                              onClick={() =>
                                setFullViewExpandAddSetRowIds((prev) => {
                                  const next = new Set(prev);
                                  next.add(sessionExercise.id);
                                  return next;
                                })
                              }
                            >
                              <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              Add more sets
                            </ActionButton>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                    {canManageSets && !hideFullViewAddSetRow ? (
                      <tr>
                        <td className="px-2 py-2">
                          <label className="inline-flex cursor-pointer items-center gap-2 text-zinc-800">
                            <input
                              type="checkbox"
                              checked={addDraft.isWarmup}
                              onChange={(event) =>
                                updateAddDraft(sessionExercise.id, "isWarmup", event.target.checked)
                              }
                              className="rounded border-zinc-300 text-sky-700 focus:ring-sky-600"
                            />
                            <span className="text-xs">Warmup?</span>
                          </label>
                        </td>
                        <td className="px-2 py-2">
                          <span className="inline-flex items-center gap-1 text-xs text-zinc-600">
                            <Plus className="h-3 w-3 text-sky-700" />
                            New
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min={0}
                            step="0.25"
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
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleAddSet(sessionExercise.id)}
                              disabled={isSavingSet || isPlannedSession}
                              className="inline-flex w-24 items-center justify-center gap-1 rounded-md border border-sky-700 bg-sky-700 px-2 py-1 text-xs text-white hover:border-sky-600 hover:bg-sky-600"
                            >
                              <Plus className="h-3.5 w-3.5 text-white" />
                              Add set
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
                </div>
              ) : null}
            </section>
          );
            })}
          </div>
        )}

        {!isReadOnly ? (
          isCompactView ? (
            null
          ) : (
            <section className="panel mt-4 border-zinc-200 bg-zinc-50/80 p-5 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddExerciseExpanded((prev) => !prev)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-zinc-100 hover:text-zinc-900"
                  aria-label={isAddExerciseExpanded ? "Collapse add exercise section" : "Expand add exercise section"}
                >
                  {isAddExerciseExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5 text-zinc-500" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddExerciseExpanded((prev) => !prev)}
                  className="text-base font-medium hover:text-zinc-900"
                >
                  Add exercise to this session
                </button>
              </div>
              {isAddExerciseExpanded ? (
                <>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-medium sm:col-span-2">
                      Exercise
                      <ExerciseSearchSelect
                        className="mt-1 w-full"
                        options={addExercisePickerOptions}
                        value={addExerciseDraft.exerciseId}
                        onChange={(exerciseId) =>
                          setAddExerciseDraft((prev) => ({ ...prev, exerciseId }))
                        }
                      />
                    </label>
                    <label className="block text-sm font-medium">
                      Base weight (kg)
                      <input
                        type="number"
                        min={0}
                        step="0.25"
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
                    <p className="text-xs text-zinc-600 sm:col-span-2">
                      Target fields apply to working sets only; warmups do not count.
                    </p>
                    <label className="block text-sm font-medium">
                      Target working sets
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
                      Target weight (kg)
                      <input
                        type="number"
                        min={0}
                        step="0.25"
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
                      Target reps (working sets)
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
                    <div className="sm:col-span-2">
                      <NotesTextareaField
                        label="Notes (optional)"
                        value={addExerciseDraft.notes}
                        onChange={(nextValue) =>
                          setAddExerciseDraft((prev) => ({ ...prev, notes: nextValue }))
                        }
                        placeholder="Optional exercise notes"
                        maxLength={maxExerciseNotesLength}
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={addExerciseToSession}
                      disabled={isAddingExercise}
                      className="inline-flex h-10 items-center justify-center gap-1 rounded-md border px-3 py-2 text-sm hover:border-sky-400 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-60"
                    >
                    <Plus className="h-3.5 w-3.5 text-sky-700" />
                      {isAddingExercise ? "Adding..." : "Add exercise"}
                    </button>
                  </div>
                </>
              ) : null}
            </section>
          )
        ) : null}
      </section>

      {isCompactView && !isReadOnly && activeSessionExercise ? (
        <CompactStickyBar
          actions={
            <>
              <button
                type="button"
                onClick={() => setIsAddExerciseSheetOpen(true)}
                className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-2 text-xs font-medium text-zinc-800 shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:border-sky-300 hover:bg-zinc-100 sm:px-2.5 sm:text-sm"
              >
                <Plus className="h-3.5 w-3.5 shrink-0 text-sky-700" aria-hidden />
                <span className="truncate">Add exercise</span>
              </button>
              <button
                type="button"
                onClick={() => startTargetsEdit(activeSessionExercise, "sheet")}
                title="Edit planned working-set targets (warmups do not count)."
                className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-2 text-xs font-medium text-zinc-800 shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:border-sky-300 hover:bg-zinc-100 sm:px-2.5 sm:text-sm"
              >
                <ListChecks className="h-3.5 w-3.5 shrink-0 text-sky-700" aria-hidden />
                <span className="truncate">Set targets</span>
              </button>
              {canManageSets && !stickyHideAddSetButton ? (
                <button
                  type="button"
                  onClick={() => handleAddSet(activeSessionExercise.id)}
                  disabled={isSavingSet || isPlannedSession}
                  className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-md border border-sky-700 bg-sky-700 px-2 text-xs font-medium text-white shadow-[0_4px_12px_rgba(0,0,0,0.14)] hover:border-sky-600 hover:bg-sky-600 disabled:opacity-60 sm:px-2.5 sm:text-sm"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{isSavingSet ? "Adding..." : "Add set"}</span>
                </button>
              ) : null}
            </>
          }
          progressLabel={`${activeExerciseIndex + 1}/${sessionExercises.length}`}
          onPrevious={() => setActiveExerciseIndex((prev) => Math.max(0, prev - 1))}
          onNext={() =>
            setActiveExerciseIndex((prev) => Math.min(sessionExercises.length - 1, prev + 1))
          }
          isPreviousDisabled={activeExerciseIndex === 0}
          isNextDisabled={activeExerciseIndex === sessionExercises.length - 1}
          nextLabel={stickyNextLabel}
        />
      ) : null}
      {!isReadOnly && isTargetsSheetOpen ? (
        <div className="fixed inset-0 z-50">
          <div
            role="button"
            tabIndex={0}
            aria-label="Close targets form"
            onClick={() => {
              cancelTargetsEdit();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                cancelTargetsEdit();
              }
            }}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-xl bg-white p-4 shadow-2xl">
            <div className="mx-auto w-full max-w-5xl">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold">Set targets</h2>
                <button
                  type="button"
                  onClick={cancelTargetsEdit}
                  className="rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-800 hover:border-sky-300 hover:bg-zinc-100"
                >
                  Close
                </button>
              </div>
              <p className="mb-2 text-xs text-zinc-600">{targetsExerciseLabel}</p>
              <p className="mb-3 text-xs text-zinc-600">
                Values apply to working sets only; warmups do not count.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <label className="block text-sm font-medium">
                  Target working sets
                  <input
                    type="number"
                    min={1}
                    value={targetsSets}
                    onChange={(event) => setTargetsSets(event.target.value)}
                    className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                    placeholder="e.g. 3"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Target weight (kg)
                  <input
                    type="number"
                    min={0}
                    step="0.25"
                    value={targetsWeightKg}
                    onChange={(event) => setTargetsWeightKg(event.target.value)}
                    className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                    placeholder="e.g. 60"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Target reps (working sets)
                  <input
                    type="number"
                    min={1}
                    value={targetsReps}
                    onChange={(event) => setTargetsReps(event.target.value)}
                    className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                    placeholder="e.g. 8"
                  />
                </label>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={cancelTargetsEdit}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-3 text-sm text-zinc-800 hover:border-sky-300 hover:bg-zinc-100"
                >
                  <X className="h-3.5 w-3.5 text-zinc-500" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => saveTargetsForExercise()}
                  disabled={isSavingTargets}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-1 rounded-md border border-sky-700 bg-sky-700 px-3 text-sm font-medium text-white hover:border-sky-600 hover:bg-sky-600 disabled:opacity-60"
                >
                  <Check className="h-3.5 w-3.5 text-white" />
                  {isSavingTargets ? "Saving..." : "Save targets"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {isCompactView && !isReadOnly && isAddExerciseSheetOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            role="button"
            tabIndex={0}
            aria-label="Close add exercise form"
            onClick={() => setIsAddExerciseSheetOpen(false)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setIsAddExerciseSheetOpen(false);
              }
            }}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-xl bg-white p-4 shadow-2xl">
            <div className="mx-auto w-full max-w-5xl">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold">Add exercise</h2>
                <button
                  type="button"
                  onClick={() => setIsAddExerciseSheetOpen(false)}
                  className="rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-800 hover:border-sky-300 hover:bg-zinc-100"
                >
                  Close
                </button>
              </div>
              <div className="grid gap-3">
                <label className="block text-sm font-medium">
                  Exercise
                  <ExerciseSearchSelect
                    className="mt-1 w-full"
                    options={addExercisePickerOptions}
                    value={addExerciseDraft.exerciseId}
                    onChange={(exerciseId) =>
                      setAddExerciseDraft((prev) => ({ ...prev, exerciseId }))
                    }
                  />
                </label>
                <p className="text-xs text-zinc-600">
                  Target fields apply to working sets only; warmups do not count.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm font-medium">
                    Base (kg)
                    <input
                      type="number"
                      min={0}
                      step="0.25"
                      value={addExerciseDraft.baseWeightKg}
                      onChange={(event) =>
                        setAddExerciseDraft((prev) => ({ ...prev, baseWeightKg: event.target.value }))
                      }
                      className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Target working sets
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
                    Target weight (kg)
                    <input
                      type="number"
                      min={0}
                      step="0.25"
                      value={addExerciseDraft.targetWeightKg}
                      onChange={(event) =>
                        setAddExerciseDraft((prev) => ({ ...prev, targetWeightKg: event.target.value }))
                      }
                      className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                      placeholder="e.g. 60"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Target reps (working sets)
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
                </div>
                <NotesTextareaField
                  label="Notes (optional)"
                  value={addExerciseDraft.notes}
                  onChange={(nextValue) =>
                    setAddExerciseDraft((prev) => ({ ...prev, notes: nextValue }))
                  }
                  placeholder="Optional exercise notes"
                  maxLength={maxExerciseNotesLength}
                />
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddExerciseSheetOpen(false)}
                    className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-zinc-300 bg-zinc-50 px-3 text-sm text-zinc-800 hover:border-sky-300 hover:bg-zinc-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={addExerciseToSession}
                    disabled={isAddingExercise}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-1 rounded-md border border-sky-700 bg-sky-700 px-3 text-sm font-medium text-white hover:border-sky-600 hover:bg-sky-600 disabled:opacity-60"
                  >
                    <Plus className="h-3.5 w-3.5 text-white" />
                    {isAddingExercise ? "Adding..." : "Add"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
