"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Dumbbell } from "lucide-react";
import { PageShell } from "@/app/components/page-shell";
import { StatusNotice } from "@/app/components/status-notice";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import { formatDateOnlyForLocale } from "@/lib/date-format";
import { toExerciseBadge } from "@/lib/exercise-badge";

type ExerciseRow = {
  id: string;
  slug: string;
};

type TranslationRow = {
  name: string;
};

type SessionRow = {
  id: string;
  performed_on: string;
};

type SessionExerciseRow = {
  id: string;
  session_id: string;
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
  setNumber: number;
  reps: number;
  weightKg: number | null;
  isWarmup: boolean;
};

function isRowMoreRecent(left: ExerciseSetHistoryRow, right: ExerciseSetHistoryRow): boolean {
  if (left.performedOn !== right.performedOn) {
    return left.performedOn > right.performedOn;
  }
  return left.setNumber > right.setNumber;
}

function isRowEarlier(left: ExerciseSetHistoryRow, right: ExerciseSetHistoryRow): boolean {
  if (left.performedOn !== right.performedOn) {
    return left.performedOn < right.performedOn;
  }
  return left.setNumber < right.setNumber;
}

function normalizeLoadedForComparison(weightKg: number | null): number {
  return weightKg ?? Number.NEGATIVE_INFINITY;
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

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!slug) {
        setIsNotFound(true);
        setIsLoading(false);
        return;
      }

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

      const { data: exerciseData, error: exerciseError } = await supabaseBrowserClient
        .from("exercises")
        .select("id, slug")
        .eq("slug", slug)
        .maybeSingle();
      if (exerciseError) {
        setErrorMessage("Could not load exercise.");
        setIsLoading(false);
        return;
      }
      if (!exerciseData) {
        setIsNotFound(true);
        setIsLoading(false);
        return;
      }

      const exercise = exerciseData as ExerciseRow;
      const { data: translationData } = await supabaseBrowserClient
        .from("exercise_translations")
        .select("name")
        .eq("exercise_id", exercise.id)
        .eq("lang_code", "en")
        .maybeSingle();

      const { data: sessionRows, error: sessionsError } = await supabaseBrowserClient
        .from("workout_sessions")
        .select("id, performed_on")
        .eq("user_id", session.user.id);
      if (sessionsError) {
        setErrorMessage("Could not load your workout sessions.");
        setIsLoading(false);
        return;
      }

      const typedSessions = (sessionRows ?? []) as SessionRow[];
      const sessionIds = typedSessions.map((row) => row.id);
      const performedOnBySessionId = new Map<string, string>();
      for (const row of typedSessions) {
        performedOnBySessionId.set(row.id, row.performed_on);
      }

      let history: ExerciseSetHistoryRow[] = [];
      if (sessionIds.length > 0) {
        const { data: sessionExerciseRows, error: sessionExercisesError } = await supabaseBrowserClient
          .from("workout_session_exercises")
          .select("id, session_id")
          .eq("exercise_id", exercise.id)
          .in("session_id", sessionIds);
        if (sessionExercisesError) {
          setErrorMessage("Could not load exercise sessions.");
          setIsLoading(false);
          return;
        }

        const typedSessionExercises = (sessionExerciseRows ?? []) as SessionExerciseRow[];
        const sessionExerciseIds = typedSessionExercises.map((row) => row.id);
        const sessionIdBySessionExerciseId = new Map<string, string>();
        for (const row of typedSessionExercises) {
          sessionIdBySessionExerciseId.set(row.id, row.session_id);
        }

        if (sessionExerciseIds.length > 0) {
          const { data: setRows, error: setsError } = await supabaseBrowserClient
            .from("workout_sets")
            .select("session_exercise_id, set_number, reps, weight_kg, is_warmup")
            .in("session_exercise_id", sessionExerciseIds);
          if (setsError) {
            setErrorMessage("Could not load exercise sets.");
            setIsLoading(false);
            return;
          }

          history = ((setRows ?? []) as WorkoutSetRow[])
            .map((setRow) => {
              const sessionId = sessionIdBySessionExerciseId.get(setRow.session_exercise_id);
              if (!sessionId) {
                return null;
              }
              const performedOn = performedOnBySessionId.get(sessionId);
              if (!performedOn) {
                return null;
              }
              return {
                sessionId,
                performedOn,
                setNumber: setRow.set_number,
                reps: setRow.reps,
                weightKg: setRow.weight_kg,
                isWarmup: setRow.is_warmup,
              };
            })
            .filter((row): row is ExerciseSetHistoryRow => row !== null)
            .sort((a, b) => {
              if (a.performedOn !== b.performedOn) {
                return b.performedOn.localeCompare(a.performedOn);
              }
              return a.setNumber - b.setNumber;
            });
        }
      }

      if (!isMounted) {
        return;
      }
      setExerciseLabel((translationData as TranslationRow | null)?.name ?? exercise.slug);
      setHistoryRows(history);
      setIsLoading(false);
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

  const topRepsRowKey = useMemo(() => {
    if (historyRows.length === 0) {
      return null;
    }
    let selectedRow: ExerciseSetHistoryRow | null = null;
    for (const row of historyRows) {
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
  }, [historyRows]);

  return (
    <PageShell>
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="inline-flex min-w-0 items-center gap-2 text-xl font-semibold tracking-tight">
            <Dumbbell className="h-5 w-5 shrink-0 text-sky-700" />
            <span className="inline-flex h-6 min-w-8 shrink-0 items-center justify-center rounded border border-zinc-300 bg-zinc-50 px-1 text-[10px] font-semibold tracking-wide text-zinc-700">
              {slug ? toExerciseBadge(slug) : "EX"}
            </span>
            <span className="truncate">{exerciseLabel || slug}</span>
          </h1>
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
            <div className="mb-3">
              <p className="text-sm text-zinc-600">{historyCountText}</p>
              {topRepsRowKey ? (
                <p className="text-xs text-zinc-500">
                  Green highlight marks your best reps set (first occurrence when tied).
                </p>
              ) : null}
            </div>
            {isCompactView ? (
              <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
                {historyRows.map((row, index) => (
                  <article
                    key={`${row.sessionId}-${row.setNumber}-${index}`}
                    className={`border-b px-2 py-1.5 text-xs last:border-b-0 ${
                      `${row.sessionId}-${row.setNumber}` === topRepsRowKey
                        ? "bg-emerald-100/70 text-emerald-950"
                        : "odd:bg-white even:bg-zinc-50/60"
                    }`}
                  >
                    {(() => {
                      const rowKey = `${row.sessionId}-${row.setNumber}`;
                      const isTopRepsRow = rowKey === topRepsRowKey;
                      return (
                    <p className="truncate text-zinc-700">
                      <span className="font-medium text-zinc-900">
                        {formatDateOnlyForLocale(row.performedOn)}
                      </span>
                      {" · "}
                      <span className="font-medium text-zinc-900">S{row.setNumber}</span>
                      {" · "}
                      <span
                        className={isTopRepsRow ? "font-medium text-emerald-900" : ""}
                      >
                        {row.reps} reps
                      </span>
                      {" · "}
                      <span
                        className={isTopRepsRow ? "font-medium text-emerald-900" : ""}
                      >
                        {row.weightKg ?? "-"} kg
                      </span>
                      {" · "}
                      {row.isWarmup ? "WU" : "WK"}
                    </p>
                      );
                    })()}
                  </article>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border border-zinc-200">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b bg-zinc-50">
                      <th className="px-3 py-2">Session date</th>
                      <th className="px-3 py-2">Set #</th>
                      <th className="px-3 py-2">Reps</th>
                      <th className="px-3 py-2">Loaded (kg)</th>
                      <th className="px-3 py-2">Warmup</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map((row, index) => (
                      (() => {
                        const rowKey = `${row.sessionId}-${row.setNumber}`;
                        const isTopRepsRow = rowKey === topRepsRowKey;
                        return (
                      <tr
                        key={`${row.sessionId}-${row.setNumber}-${index}`}
                        className={`border-b last:border-b-0 ${
                          isTopRepsRow
                            ? "bg-emerald-100/70 text-emerald-950"
                            : "odd:bg-white even:bg-zinc-50/60"
                        }`}
                      >
                        <td className="px-3 py-2">{formatDateOnlyForLocale(row.performedOn)}</td>
                        <td className="px-3 py-2">{row.setNumber}</td>
                        <td className={`px-3 py-2 ${isTopRepsRow ? "font-medium text-emerald-900" : ""}`}>
                          {row.reps}
                        </td>
                        <td className={`px-3 py-2 ${isTopRepsRow ? "font-medium text-emerald-900" : ""}`}>
                          {row.weightKg ?? "-"}
                        </td>
                        <td className="px-3 py-2">{row.isWarmup ? "Yes" : "No"}</td>
                      </tr>
                        );
                      })()
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </PageShell>
  );
}
