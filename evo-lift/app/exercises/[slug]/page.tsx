"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Dumbbell, Hash, Medal, TrendingUp, Weight } from "lucide-react";
import { AppTable } from "@/app/components/app-table";
import { PageShell } from "@/app/components/page-shell";
import { KpiBadge } from "@/app/components/kpi-badge";
import { StatusNotice } from "@/app/components/status-notice";
import { loadExerciseMetadata } from "@/lib/exercise-metadata-cache";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import { formatDateOnlyForLocale } from "@/lib/date-format";
import { toExerciseBadge } from "@/lib/exercise-badge";
import { createPageLoadPerfTracker } from "@/lib/page-load-perf";

type ExerciseRow = {
  id: string;
  slug: string;
};

type SessionRow = {
  id: string;
  performed_on: string;
  created_at: string;
};

type SessionExerciseRow = {
  id: string;
  session_id: string;
  base_weight_kg: number | null;
};

type WorkoutSetRow = {
  session_exercise_id: string;
  set_number: number;
  reps: number;
  weight_kg: number | null;
  is_warmup: boolean;
};

type ExerciseSetHistoryRow = {
  sessionId: string;
  performedOn: string;
  /** `workout_sessions.created_at` (ISO); disambiguates multiple sessions on the same `performed_on` day. */
  sessionCreatedAt: string;
  setNumber: number;
  reps: number;
  weightKg: number | null;
  totalKg: number;
  isWarmup: boolean;
};

type HistorySortKey =
  | "performedOn"
  | "setNumber"
  | "reps"
  | "weightKg"
  | "totalKg"
  | "isWarmup";
type HistorySortDirection = "asc" | "desc";

/**
 * Compact history: fixed-ish column widths so dates, loaded (kg), total (kg), and reps line up row to row.
 * Warmup column is hidden below ~22rem container width so the block avoids horizontal scroll.
 */
const COMPACT_HISTORY_GRID =
  "grid grid-cols-[minmax(5.5rem,1fr)_1.5rem_2.75rem_3.25rem_2.125rem] gap-x-1.5 @min-[22rem]:grid-cols-[minmax(5.5rem,1fr)_1.5rem_2.75rem_3.25rem_2.125rem_3.5rem]";

const COMPACT_HISTORY_WARMUP_CELL = "hidden @min-[22rem]:block";

/**
 * Sort exercise set history by session date, then session, then set index.
 *
 * Used for the **Session date** column (all breakpoints) and the default list order on `/exercises/[slug]`.
 *
 * 1. `performed_on` (`YYYY-MM-DD`): descending when `direction === "desc"` (newest day first), ascending when `"asc"`.
 * 2. Same calendar day: `session_created_at` (ISO from `workout_sessions.created_at`): descending with date desc
 *    (newer session first); ascending with date asc (earlier session first).
 * 3. Within a session: `set_number` **descending** when `direction === "desc"` (highest set / most recent work on top);
 *    **ascending** when `direction === "asc"` (chronological set order). Gaps (e.g. 1, 3 after a delete) keep numeric order.
 * 4. Stable tie-break: `session_id` ascending if timestamps ever match.
 */
function compareExerciseSetHistoryForPerformedOn(
  a: ExerciseSetHistoryRow,
  b: ExerciseSetHistoryRow,
  direction: HistorySortDirection,
): number {
  const dateCmp = a.performedOn.localeCompare(b.performedOn);
  if (dateCmp !== 0) {
    return direction === "desc" ? -dateCmp : dateCmp;
  }
  const sessionCmp = a.sessionCreatedAt.localeCompare(b.sessionCreatedAt);
  if (sessionCmp !== 0) {
    return direction === "desc" ? -sessionCmp : sessionCmp;
  }
  if (a.setNumber !== b.setNumber) {
    if (direction === "desc") {
      return b.setNumber - a.setNumber;
    }
    return a.setNumber - b.setNumber;
  }
  return a.sessionId.localeCompare(b.sessionId);
}

/** Default list order: newest day → newest session that day → highest set number first within the session. */
function compareExerciseSetHistoryRowsCanonical(a: ExerciseSetHistoryRow, b: ExerciseSetHistoryRow): number {
  return compareExerciseSetHistoryForPerformedOn(a, b, "desc");
}

function sortExerciseHistoryRowsCanonical(rows: ExerciseSetHistoryRow[]): ExerciseSetHistoryRow[] {
  rows.sort(compareExerciseSetHistoryRowsCanonical);
  return rows;
}

function isRowMoreRecent(left: ExerciseSetHistoryRow, right: ExerciseSetHistoryRow): boolean {
  if (left.performedOn !== right.performedOn) {
    return left.performedOn > right.performedOn;
  }
  if (left.sessionCreatedAt !== right.sessionCreatedAt) {
    return left.sessionCreatedAt > right.sessionCreatedAt;
  }
  return left.setNumber > right.setNumber;
}

function isRowEarlier(left: ExerciseSetHistoryRow, right: ExerciseSetHistoryRow): boolean {
  if (left.performedOn !== right.performedOn) {
    return left.performedOn < right.performedOn;
  }
  if (left.sessionCreatedAt !== right.sessionCreatedAt) {
    return left.sessionCreatedAt < right.sessionCreatedAt;
  }
  return left.setNumber < right.setNumber;
}

function normalizeLoadedForComparison(weightKg: number | null): number {
  return weightKg ?? Number.NEGATIVE_INFINITY;
}

/** Working sets with an explicit logged load (kg), for load-based KPIs. */
function loggedLoadKg(row: ExerciseSetHistoryRow): number | null {
  if (row.weightKg == null) {
    return null;
  }
  const w = Number(row.weightKg);
  return Number.isFinite(w) ? w : null;
}

/**
 * Per-set volume (kg) = loaded (kg) × reps; only when load is logged and reps are valid
 * (matches insights weekly volume: no contribution when weight is null).
 */
function setVolumeKg(row: ExerciseSetHistoryRow): number | null {
  if (!Number.isFinite(row.reps) || row.reps <= 0) {
    return null;
  }
  const loaded = loggedLoadKg(row);
  if (loaded === null) {
    return null;
  }
  return loaded * row.reps;
}

function formatKgValue(value: number | null, fractionDigits: number): string {
  return value == null ? "—" : `${value.toFixed(fractionDigits)} kg`;
}

export default function ExerciseDetailPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [exerciseLabel, setExerciseLabel] = useState("");
  const [historyRows, setHistoryRows] = useState<ExerciseSetHistoryRow[]>([]);
  const [isCompactView, setIsCompactView] = useState(false);
  const [sortKey, setSortKey] = useState<HistorySortKey>("performedOn");
  const [sortDirection, setSortDirection] = useState<HistorySortDirection>("desc");

  useEffect(() => {
    let isMounted = true;
    const perf = createPageLoadPerfTracker("/exercises/[slug]");

    async function loadData() {
      if (!slug) {
        setIsNotFound(true);
        setIsLoading(false);
        return;
      }

      const {
        data: { session },
      } = await perf.trackQuery("auth.getSession", () => supabaseBrowserClient.auth.getSession());
      if (!isMounted) {
        return;
      }
      if (!session) {
        router.replace("/login");
        return;
      }

      let metadataRows: Array<{ id: string; slug: string; label: string }> = [];
      try {
        metadataRows = await perf.trackQuery("exerciseMetadata.load", () =>
          loadExerciseMetadata(supabaseBrowserClient, { ttlMs: 5 * 60 * 1000 }),
        );
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Could not load exercise.");
        setIsLoading(false);
        perf.flush();
        return;
      }
      const exerciseData = metadataRows.find((row) => row.slug === slug);
      if (!exerciseData) {
        setIsNotFound(true);
        setIsLoading(false);
        perf.flush();
        return;
      }

      const exercise = exerciseData as ExerciseRow;

      const { data: sessionRows, error: sessionsError } = await perf.trackQuery(
        "workout_sessions.selectPerformedOn",
        () =>
          supabaseBrowserClient
            .from("workout_sessions")
            .select("id, performed_on, created_at")
            .eq("user_id", session.user.id),
      );
      if (sessionsError) {
        setErrorMessage("Could not load your workout sessions.");
        setIsLoading(false);
        perf.flush();
        return;
      }

      const typedSessions = (sessionRows ?? []) as SessionRow[];
      const sessionIds = typedSessions.map((row) => row.id);
      const sessionMetaBySessionId = new Map<string, { performedOn: string; createdAt: string }>();
      for (const row of typedSessions) {
        sessionMetaBySessionId.set(row.id, {
          performedOn: row.performed_on,
          createdAt: row.created_at,
        });
      }

      let history: ExerciseSetHistoryRow[] = [];
      if (sessionIds.length > 0) {
        const { data: sessionExerciseRows, error: sessionExercisesError } = await perf.trackQuery(
          "workout_session_exercises.selectByExerciseAndSessionIds",
          () =>
            supabaseBrowserClient
              .from("workout_session_exercises")
              .select("id, session_id, base_weight_kg")
              .eq("exercise_id", exercise.id)
              .in("session_id", sessionIds),
        );
        if (sessionExercisesError) {
          setErrorMessage("Could not load exercise sessions.");
          setIsLoading(false);
          perf.flush();
          return;
        }

        const typedSessionExercises = (sessionExerciseRows ?? []) as SessionExerciseRow[];
        const sessionExerciseIds = typedSessionExercises.map((row) => row.id);
        const sessionIdBySessionExerciseId = new Map<string, string>();
        const baseWeightBySessionExerciseId = new Map<string, number>();
        for (const row of typedSessionExercises) {
          sessionIdBySessionExerciseId.set(row.id, row.session_id);
          baseWeightBySessionExerciseId.set(row.id, row.base_weight_kg ?? 0);
        }

        if (sessionExerciseIds.length > 0) {
          const { data: setRows, error: setsError } = await perf.trackQuery(
            "workout_sets.selectBySessionExerciseIds",
            () =>
              supabaseBrowserClient
                .from("workout_sets")
                .select("session_exercise_id, set_number, reps, weight_kg, is_warmup")
                .in("session_exercise_id", sessionExerciseIds),
          );
          if (setsError) {
            setErrorMessage("Could not load exercise sets.");
            setIsLoading(false);
            perf.flush();
            return;
          }

          history = ((setRows ?? []) as WorkoutSetRow[])
            .map((setRow) => {
              const sessionId = sessionIdBySessionExerciseId.get(setRow.session_exercise_id);
              if (!sessionId) {
                return null;
              }
              const sessionMeta = sessionMetaBySessionId.get(sessionId);
              if (!sessionMeta) {
                return null;
              }
              const baseWeightRaw = baseWeightBySessionExerciseId.get(setRow.session_exercise_id) ?? 0;
              const loadedRaw = setRow.weight_kg ?? 0;
              const baseWeightValue = Number(baseWeightRaw);
              const loadedValue = Number(loadedRaw);
              const baseWeightKg = Number.isFinite(baseWeightValue) ? baseWeightValue : 0;
              const loadedKg = Number.isFinite(loadedValue) ? loadedValue : 0;
              return {
                sessionId,
                performedOn: sessionMeta.performedOn,
                sessionCreatedAt: sessionMeta.createdAt,
                setNumber: setRow.set_number,
                reps: setRow.reps,
                weightKg: setRow.weight_kg,
                totalKg: loadedKg + baseWeightKg,
                isWarmup: setRow.is_warmup,
              };
            })
            .filter((row): row is ExerciseSetHistoryRow => row !== null);
          history = sortExerciseHistoryRowsCanonical(history);
        }
      }

      if (!isMounted) {
        return;
      }
      setExerciseLabel(exerciseData.label);
      setHistoryRows(history);
      setIsLoading(false);
      perf.flush();
    }

    void loadData();
    return () => {
      isMounted = false;
    };
  }, [router, slug]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsCompactView(mediaQuery.matches);
    apply();
    const onChange = () => apply();
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  const historyCountText = useMemo(() => {
    if (historyRows.length === 1) {
      return "1 set logged";
    }
    return `${historyRows.length} sets logged`;
  }, [historyRows.length]);

  const workingRows = useMemo(
    () => historyRows.filter((row) => !row.isWarmup),
    [historyRows],
  );

  const loadStats = useMemo(() => {
    const loads = workingRows.map(loggedLoadKg).filter((v): v is number => v !== null);
    if (loads.length === 0) {
      return { maxLoaded: null as number | null, avgLoaded: null as number | null };
    }
    return {
      maxLoaded: Math.max(...loads),
      avgLoaded: loads.reduce((s, v) => s + v, 0) / loads.length,
    };
  }, [workingRows]);

  const volumeStats = useMemo(() => {
    const volumes = workingRows.map(setVolumeKg).filter((v): v is number => v !== null);
    if (volumes.length === 0) {
      return { maxTotal: null as number | null, avgTotal: null as number | null };
    }
    return {
      maxTotal: Math.max(...volumes),
      avgTotal: volumes.reduce((s, v) => s + v, 0) / volumes.length,
    };
  }, [workingRows]);

  const maxLoadedText = useMemo(
    () => formatKgValue(loadStats.maxLoaded, 1),
    [loadStats.maxLoaded],
  );
  const maxTotalText = useMemo(
    () => formatKgValue(volumeStats.maxTotal, 1),
    [volumeStats.maxTotal],
  );
  const averageLoadedText = useMemo(
    () => formatKgValue(loadStats.avgLoaded, 1),
    [loadStats.avgLoaded],
  );
  const averageTotalText = useMemo(
    () => formatKgValue(volumeStats.avgTotal, 1),
    [volumeStats.avgTotal],
  );

  /** Default date + session + set order (newest first, highest set first); same as Session date ↓ on wide layout. */
  const compactHistoryRows = useMemo(
    () => sortExerciseHistoryRowsCanonical([...historyRows]),
    [historyRows],
  );

  const topRepsRowKey = useMemo(() => {
    if (workingRows.length === 0) {
      return null;
    }
    let selectedRow: ExerciseSetHistoryRow | null = null;
    for (const row of workingRows) {
      if (!selectedRow || row.reps > selectedRow.reps) {
        selectedRow = row;
        continue;
      }
      if (selectedRow && row.reps === selectedRow.reps) {
        const rowLoaded = normalizeLoadedForComparison(row.weightKg);
        const selectedLoaded = normalizeLoadedForComparison(selectedRow.weightKg);
        if (rowLoaded > selectedLoaded) {
          selectedRow = row;
          continue;
        }
        if (rowLoaded === selectedLoaded && isRowEarlier(row, selectedRow)) {
          selectedRow = row;
        }
      }
    }
    if (!selectedRow) {
      return null;
    }
    return `${selectedRow.sessionId}-${selectedRow.setNumber}`;
  }, [workingRows]);

  const sortedTableRows = useMemo(() => {
    const next = [...historyRows];
    next.sort((left, right) => {
      let leftValue: string | number = "";
      let rightValue: string | number = "";
      if (sortKey === "performedOn") {
        return compareExerciseSetHistoryForPerformedOn(left, right, sortDirection);
      } else if (sortKey === "setNumber") {
        leftValue = left.setNumber;
        rightValue = right.setNumber;
      } else if (sortKey === "reps") {
        leftValue = left.reps;
        rightValue = right.reps;
      } else if (sortKey === "weightKg") {
        leftValue = left.weightKg ?? Number.NEGATIVE_INFINITY;
        rightValue = right.weightKg ?? Number.NEGATIVE_INFINITY;
      } else if (sortKey === "totalKg") {
        leftValue = left.totalKg;
        rightValue = right.totalKg;
      } else if (sortKey === "isWarmup") {
        leftValue = left.isWarmup ? 1 : 0;
        rightValue = right.isWarmup ? 1 : 0;
      }
      if (leftValue < rightValue) return sortDirection === "asc" ? -1 : 1;
      if (leftValue > rightValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return next;
  }, [historyRows, sortDirection, sortKey]);

  function handleSort(nextKey: HistorySortKey) {
    if (sortKey === nextKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "performedOn" ? "desc" : "asc");
  }

  function renderSortIndicator(nextKey: HistorySortKey) {
    if (sortKey !== nextKey) {
      return <span className="text-zinc-400">-</span>;
    }
    return <span>{sortDirection === "asc" ? "↑" : "↓"}</span>;
  }

  return (
    <PageShell>
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="inline-flex min-w-0 items-center gap-2 text-xl font-semibold tracking-tight">
              <Dumbbell className="h-5 w-5 shrink-0 text-sky-700" />
              <span className="inline-flex h-6 min-w-8 shrink-0 items-center justify-center rounded border border-zinc-300 bg-zinc-50 px-1 text-[10px] font-semibold tracking-wide text-zinc-700">
                {slug ? toExerciseBadge(slug) : "EX"}
              </span>
              <span className="truncate">{exerciseLabel || slug}</span>
            </h1>
          </div>
          <Link
            href="/exercises"
            className="inline-flex h-9 items-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-3 text-sm text-zinc-800 hover:border-sky-300 hover:bg-zinc-100"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-sky-700" />
            Back to exercises
          </Link>
        </div>
      </section>

      <section className="panel p-5">
        {errorMessage ? (
          <StatusNotice message={errorMessage} tone="error" />
        ) : isLoading ? (
          <p className="text-sm text-zinc-600">Loading exercise history...</p>
        ) : isNotFound ? (
          <p className="text-sm text-zinc-600">
            Exercise not found. Please check the link or open an exercise from the list.
          </p>
        ) : historyRows.length === 0 ? (
          <p className="text-sm text-zinc-600">
            No sets logged yet for this exercise.
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <KpiBadge
                label="Logged sets"
                value={String(historyRows.length)}
                icon={<Hash className="h-4 w-4 text-zinc-600" />}
                tone="neutral"
                className="sm:min-w-36"
                description="All sets for this exercise, warmups included."
              />
              <div className="grid w-full grid-cols-2 gap-2 sm:w-fit sm:grid-cols-4">
                <KpiBadge
                  label="Avg loaded (kg)"
                  value={averageLoadedText}
                  icon={<Weight className="h-4 w-4 text-sky-700" />}
                  description="Average loaded weight on working sets (no warmups). Only sets where you logged a weight."
                />
                <KpiBadge
                  label="Max loaded (kg)"
                  value={maxLoadedText}
                  icon={<Weight className="h-4 w-4 text-emerald-700" />}
                  description="Heaviest single working set by loaded weight (no warmups). Only sets with logged weight."
                  tone="success"
                />
                <KpiBadge
                  label="Avg total"
                  value={averageTotalText}
                  icon={<TrendingUp className="h-4 w-4 text-sky-700" />}
                  description="Average loaded (kg) × reps per working set (no warmups). Skips sets without logged weight or valid reps."
                />
                <KpiBadge
                  label="Max total"
                  value={maxTotalText}
                  icon={<TrendingUp className="h-4 w-4 text-emerald-700" />}
                  description="Best single working set by loaded (kg) × reps (no warmups). Skips sets without logged weight or valid reps."
                  tone="success"
                />
              </div>
            </div>
            {isCompactView ? (
              <div className="@container overflow-x-auto rounded-md border border-zinc-200 bg-white">
                <div
                  className={`${COMPACT_HISTORY_GRID} border-b bg-zinc-50 px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500`}
                >
                  <span>Date</span>
                  <span className="text-right">Set</span>
                  <span className="text-right">Kg</span>
                  <span className="text-right">Total</span>
                  <span className="text-right">Reps</span>
                  <span className={`text-center ${COMPACT_HISTORY_WARMUP_CELL}`}>Warmup</span>
                </div>
                {compactHistoryRows.map((row, index) => (
                  <article
                    key={`${row.sessionId}-${row.setNumber}-${index}`}
                    className={`cursor-pointer border-b px-2 py-1.5 text-xs last:border-b-0 ${
                      `${row.sessionId}-${row.setNumber}` === topRepsRowKey
                        ? "bg-emerald-100/70 text-emerald-950 hover:bg-emerald-100"
                        : "odd:bg-white even:bg-zinc-50/60 hover:bg-zinc-100/70"
                    }`}
                    onClick={() => router.push(`/sessions/${row.sessionId}`)}
                    title={
                      (`${row.sessionId}-${row.setNumber}` === topRepsRowKey
                        ? "Best set marker: top reps (with tie-break rules). Open session."
                        : "Set details for this exercise entry. Open session.") +
                      (row.isWarmup ? " Warmup: yes." : " Warmup: no.")
                    }
                  >
                    {(() => {
                      const rowKey = `${row.sessionId}-${row.setNumber}`;
                      const isTopRepsRow = rowKey === topRepsRowKey;
                      return (
                        <div className={`${COMPACT_HISTORY_GRID} items-center text-zinc-700`}>
                          <div className="flex min-w-0 items-center gap-1">
                            <span className="truncate font-medium tabular-nums text-zinc-900">
                              {formatDateOnlyForLocale(row.performedOn)}
                            </span>
                            {isTopRepsRow ? (
                              <Medal
                                className="h-3.5 w-3.5 shrink-0 text-amber-600"
                                aria-hidden
                              />
                            ) : (
                              <span className="inline-block h-3.5 w-3.5 shrink-0" aria-hidden />
                            )}
                          </div>
                          <span className="text-right font-medium tabular-nums text-zinc-900">
                            {row.setNumber}
                          </span>
                          <span
                            className={`text-right tabular-nums ${
                              isTopRepsRow ? "font-medium text-emerald-900" : ""
                            }`}
                          >
                            {row.weightKg ?? "—"}
                          </span>
                          <span
                            className={`text-right tabular-nums ${
                              isTopRepsRow ? "font-medium text-emerald-900" : ""
                            }`}
                          >
                            {row.totalKg.toFixed(1)}
                          </span>
                          <span
                            className={`text-right tabular-nums ${
                              isTopRepsRow ? "font-medium text-emerald-900" : ""
                            }`}
                          >
                            {row.reps}
                          </span>
                          <span className={`text-center text-zinc-600 ${COMPACT_HISTORY_WARMUP_CELL}`}>
                            {row.isWarmup ? "Yes" : "No"}
                          </span>
                        </div>
                      );
                    })()}
                  </article>
                ))}
              </div>
            ) : (
              <AppTable tableClassName="min-w-[760px]">
                  <thead>
                    <tr className="border-b">
                      <th className="px-2 py-2 font-medium">
                        <button type="button" onClick={() => handleSort("performedOn")} className="inline-flex items-center gap-1">
                          Session date {renderSortIndicator("performedOn")}
                        </button>
                      </th>
                      <th className="px-2 py-2 font-medium">
                        <button type="button" onClick={() => handleSort("setNumber")} className="inline-flex items-center gap-1">
                          Set # {renderSortIndicator("setNumber")}
                        </button>
                      </th>
                      <th className="px-2 py-2 font-medium">
                        <button type="button" onClick={() => handleSort("weightKg")} className="inline-flex items-center gap-1">
                          Loaded (kg) {renderSortIndicator("weightKg")}
                        </button>
                      </th>
                      <th className="px-2 py-2 font-medium">
                        <button
                          type="button"
                          onClick={() => handleSort("totalKg")}
                          className="inline-flex items-center gap-1"
                          title="Loaded weight plus optional base weight for this exercise on that session."
                        >
                          Total (kg) {renderSortIndicator("totalKg")}
                        </button>
                      </th>
                      <th className="px-2 py-2 font-medium">
                        <button type="button" onClick={() => handleSort("reps")} className="inline-flex items-center gap-1">
                          Reps {renderSortIndicator("reps")}
                        </button>
                      </th>
                      <th className="px-2 py-2 font-medium">
                        <button type="button" onClick={() => handleSort("isWarmup")} className="inline-flex items-center gap-1">
                          Warmup {renderSortIndicator("isWarmup")}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTableRows.map((row, index) => (
                      (() => {
                        const rowKey = `${row.sessionId}-${row.setNumber}`;
                        const isTopRepsRow = rowKey === topRepsRowKey;
                        return (
                      <tr
                        key={`${row.sessionId}-${row.setNumber}-${index}`}
                        className={`cursor-pointer border-b last:border-b-0 ${
                          isTopRepsRow
                            ? "bg-emerald-100/70 text-emerald-950 hover:bg-emerald-100"
                            : "odd:bg-white even:bg-zinc-50/60 hover:bg-zinc-100/70"
                        }`}
                        onClick={() => router.push(`/sessions/${row.sessionId}`)}
                        title={
                          isTopRepsRow
                            ? "Best set marker: top reps (with tie-break rules). Open session."
                            : "Set details for this exercise entry. Open session."
                        }
                      >
                        <td className="px-2 py-2">
                          <span className="inline-flex items-center gap-1">
                            {formatDateOnlyForLocale(row.performedOn)}
                            {isTopRepsRow ? (
                              <Medal className="h-3.5 w-3.5 text-amber-600" />
                            ) : null}
                          </span>
                        </td>
                        <td className="px-2 py-2">{row.setNumber}</td>
                        <td className={`px-2 py-2 ${isTopRepsRow ? "font-medium text-emerald-900" : ""}`}>
                          {row.weightKg ?? "-"}
                        </td>
                        <td className={`px-2 py-2 ${isTopRepsRow ? "font-medium text-emerald-900" : ""}`}>
                          {row.totalKg.toFixed(1)}
                        </td>
                        <td className={`px-2 py-2 ${isTopRepsRow ? "font-medium text-emerald-900" : ""}`}>
                          {row.reps}
                        </td>
                        <td className="px-2 py-2">{row.isWarmup ? "Yes" : "No"}</td>
                      </tr>
                        );
                      })()
                    ))}
                  </tbody>
              </AppTable>
            )}
          </>
        )}
      </section>
    </PageShell>
  );
}
