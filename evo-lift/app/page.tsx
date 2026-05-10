"use client";

import Link from "next/link";
import { ClipboardList, Dumbbell, FilterX, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/app/components/action-button";
import { DateInput } from "@/app/components/date-input";
import { PageShell } from "@/app/components/page-shell";
import { NewSessionDraftCallout } from "@/app/components/new-session-draft-callout";
import { SessionsTable, type SessionsTableRow } from "@/app/components/sessions-table";
import { WorkoutActivityChart } from "@/app/components/workout-activity-chart";
import { supabaseBrowserClient } from "@/lib/supabase/browser";

type WorkoutSessionRow = {
  id: string;
  performed_on: string;
  notes: string | null;
  created_at: string;
};

type SessionExerciseRow = {
  id: string;
  session_id: string;
  exercise_id: string;
};

type WorkoutSetLinkRow = {
  session_exercise_id: string | null;
};

type ExerciseRow = {
  id: string;
  slug: string;
};

type SessionExerciseBadge = {
  slug: string;
  hasLoggedSet: boolean;
};

function formatDateToYyyyMmDd(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultDateRange(): { from: string; to: string } {
  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(today.getFullYear() - 1);
  return {
    from: formatDateToYyyyMmDd(oneYearAgo),
    to: formatDateToYyyyMmDd(today),
  };
}

function normalizeDateOnly(value: string): string {
  // Supabase may return date-only or datetime strings; normalize to YYYY-MM-DD.
  return value.slice(0, 10);
}

function dateToYyyyMmDd(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayYyyyMmDd(): string {
  return dateToYyyyMmDd(new Date());
}

export default function Home() {
  const router = useRouter();
  const todayYyyyMmDd = getTodayYyyyMmDd();
  const defaultDateRange = useMemo(() => getDefaultDateRange(), []);
  const [isSmallPhone, setIsSmallPhone] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [sessions, setSessions] = useState<WorkoutSessionRow[]>([]);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(defaultDateRange.from);
  const [dateTo, setDateTo] = useState(defaultDateRange.to);
  const [openingSessionId, setOpeningSessionId] = useState<string | null>(null);
  const [highlightedActivityDates, setHighlightedActivityDates] = useState<string[] | null>(null);
  const [exerciseBadgesBySessionId, setExerciseBadgesBySessionId] = useState<
    Map<string, SessionExerciseBadge[]>
  >(new Map());
  const [setCountBySessionId, setSetCountBySessionId] = useState<Map<string, number>>(new Map());
  const [userId, setUserId] = useState<string | null>(null);
  const reloadHomeSessionsRef = useRef<() => void>(() => {});

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

      const { data, error } = await supabaseBrowserClient
        .from("workout_sessions")
        .select("id, performed_on, notes, created_at");

      if (!isMounted) {
        return;
      }

      if (error) {
        setSessionsError("Could not load workout sessions.");
        setIsChecking(false);
        return;
      }

      const loadedSessions = (data ?? []) as WorkoutSessionRow[];
      setSessions(loadedSessions);

      const sessionIds = loadedSessions.map((row) => row.id);
      if (sessionIds.length > 0) {
        const { data: sessionExercisesData, error: sessionExercisesError } = await supabaseBrowserClient
          .from("workout_session_exercises")
          .select("id, session_id, exercise_id")
          .in("session_id", sessionIds);

        if (sessionExercisesError) {
          setSessionsError("Could not load session exercises.");
          setIsChecking(false);
          return;
        }

        const typedSessionExercises = (sessionExercisesData ?? []) as SessionExerciseRow[];
        const uniqueExerciseIds = [...new Set(typedSessionExercises.map((item) => item.exercise_id))];
        const sessionExerciseIds = typedSessionExercises.map((item) => item.id);
        const sessionExerciseIdsWithSets = new Set<string>();

        if (sessionExerciseIds.length > 0) {
          const { data: setsData, error: setsError } = await supabaseBrowserClient
            .from("workout_sets")
            .select("session_exercise_id")
            .in("session_exercise_id", sessionExerciseIds);

          if (setsError) {
            setSessionsError("Could not load workout sets.");
            setIsChecking(false);
            return;
          }

          for (const row of (setsData ?? []) as WorkoutSetLinkRow[]) {
            if (row.session_exercise_id) {
              sessionExerciseIdsWithSets.add(row.session_exercise_id);
            }
          }

          const sessionIdBySessionExerciseId = new Map<string, string>();
          for (const exerciseRow of typedSessionExercises) {
            sessionIdBySessionExerciseId.set(exerciseRow.id, exerciseRow.session_id);
          }
          const nextSetCountBySessionId = new Map<string, number>();
          for (const row of (setsData ?? []) as WorkoutSetLinkRow[]) {
            if (!row.session_exercise_id) {
              continue;
            }
            const sessionId = sessionIdBySessionExerciseId.get(row.session_exercise_id);
            if (!sessionId) {
              continue;
            }
            nextSetCountBySessionId.set(sessionId, (nextSetCountBySessionId.get(sessionId) ?? 0) + 1);
          }
          setSetCountBySessionId(nextSetCountBySessionId);
        }

        const slugByExerciseId = new Map<string, string>();
        if (uniqueExerciseIds.length > 0) {
          const { data: exercisesData, error: exercisesError } = await supabaseBrowserClient
            .from("exercises")
            .select("id, slug")
            .in("id", uniqueExerciseIds);

          if (exercisesError) {
            setSessionsError("Could not load exercises.");
            setIsChecking(false);
            return;
          }

          for (const exercise of (exercisesData ?? []) as ExerciseRow[]) {
            slugByExerciseId.set(exercise.id, exercise.slug);
          }
        }

        const nextMap = new Map<string, SessionExerciseBadge[]>();
        for (const item of typedSessionExercises) {
          const slug = slugByExerciseId.get(item.exercise_id);
          if (!slug) {
            continue;
          }
          const current = nextMap.get(item.session_id) ?? [];
          current.push({
            slug,
            hasLoggedSet: sessionExerciseIdsWithSets.has(item.id),
          });
          nextMap.set(item.session_id, current);
        }
        setExerciseBadgesBySessionId(nextMap);
      } else {
        setExerciseBadgesBySessionId(new Map());
        setSetCountBySessionId(new Map());
      }

      setIsChecking(false);
    }

    reloadHomeSessionsRef.current = () => {
      void checkSession();
    };

    void checkSession();

    return () => {
      isMounted = false;
    };
  }, [router]);

  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        reloadHomeSessionsRef.current();
      }
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        reloadHomeSessionsRef.current();
      }
    }
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const completedSessions = useMemo(
    () => sessions.filter((session) => normalizeDateOnly(session.performed_on) <= todayYyyyMmDd),
    [sessions, todayYyyyMmDd],
  );

  const plannedSessions = useMemo(
    () =>
      sessions
        .filter((session) => normalizeDateOnly(session.performed_on) > todayYyyyMmDd)
        .sort((a, b) => a.performed_on.localeCompare(b.performed_on)),
    [sessions, todayYyyyMmDd],
  );


  const filteredSessions = useMemo(() => {
    return completedSessions.filter((session) => {
      const performedOn = normalizeDateOnly(session.performed_on);
      if (dateFrom && performedOn < dateFrom) {
        return false;
      }
      if (dateTo && performedOn > dateTo) {
        return false;
      }
      return true;
    });
  }, [completedSessions, dateFrom, dateTo]);

  const workoutActivityData = useMemo(() => {
    const completedSessions = filteredSessions.filter(
      (session) => normalizeDateOnly(session.performed_on) <= todayYyyyMmDd,
    );
    const sortedCompletedDates = completedSessions
      .map((session) => normalizeDateOnly(session.performed_on))
      .sort();
    const fallbackTo = todayYyyyMmDd;
    const fallbackFromDate = new Date(`${fallbackTo}T00:00:00`);
    fallbackFromDate.setDate(fallbackFromDate.getDate() - 26 * 7 + 1);
    const fallbackFrom = dateToYyyyMmDd(fallbackFromDate);
    const effectiveFrom = dateFrom || sortedCompletedDates[0] || fallbackFrom;
    const requestedTo = dateTo || sortedCompletedDates[sortedCompletedDates.length - 1] || fallbackTo;
    const effectiveTo = requestedTo > todayYyyyMmDd ? todayYyyyMmDd : requestedTo;
    if (!effectiveFrom || !effectiveTo) {
      return [];
    }

    const points: Array<{ date: string; workouts: number; sets: number }> = [];
    const current = new Date(`${effectiveFrom}T00:00:00`);
    const end = new Date(`${effectiveTo}T00:00:00`);
    const workoutsByDate = new Map<string, number>();
    const setsByDate = new Map<string, number>();
    for (const session of completedSessions) {
      const day = normalizeDateOnly(session.performed_on);
      workoutsByDate.set(day, (workoutsByDate.get(day) ?? 0) + 1);
      setsByDate.set(day, (setsByDate.get(day) ?? 0) + (setCountBySessionId.get(session.id) ?? 0));
    }
    while (current <= end) {
      const day = dateToYyyyMmDd(current);
      points.push({
        date: day,
        workouts: workoutsByDate.get(day) ?? 0,
        sets: setsByDate.get(day) ?? 0,
      });
      current.setDate(current.getDate() + 1);
    }
    return points;
  }, [dateFrom, dateTo, filteredSessions, setCountBySessionId, todayYyyyMmDd]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsSmallPhone(mediaQuery.matches);
    apply();
    const onChange = () => apply();
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  const completedTableRows: SessionsTableRow[] = useMemo(
    () =>
      filteredSessions.map((session) => ({
        id: session.id,
        performedOn: session.performed_on,
        notes: session.notes ?? "",
        isPlanned: false,
        badges: exerciseBadgesBySessionId.get(session.id) ?? [],
      })),
    [exerciseBadgesBySessionId, filteredSessions],
  );

  const plannedTableRows: SessionsTableRow[] = useMemo(
    () =>
      plannedSessions.map((session) => ({
        id: session.id,
        performedOn: session.performed_on,
        notes: session.notes ?? "",
        isPlanned: true,
        badges: exerciseBadgesBySessionId.get(session.id) ?? [],
      })),
    [exerciseBadgesBySessionId, plannedSessions],
  );

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
          <ClipboardList className="h-6 w-6 text-sky-700" />
          Workout sessions
        </h1>
        <Link
          href="/sessions/new"
          className="inline-flex h-10 items-center justify-center gap-1 rounded-md border border-sky-700 bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:border-sky-600 hover:bg-sky-600"
          aria-label="Add workout session"
          title="Add workout session"
        >
          <Plus className="h-3.5 w-3.5 text-white" />
          <span className="hidden sm:inline">Add workout session</span>
        </Link>
      </div>
      {userId ? <NewSessionDraftCallout userId={userId} /> : null}
      <section className="panel p-5">
        {sessionsError ? (
          <p className="text-sm text-red-600">{sessionsError}</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-medium text-zinc-800">Past workouts</h2>
              <Link
                href="/exercises"
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 underline-offset-2 hover:text-sky-800 hover:underline"
              >
                <Dumbbell className="h-3.5 w-3.5 text-sky-700" />
                Exercises
              </Link>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-xs font-medium text-zinc-600">
                  From
                  <DateInput
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                    max={todayYyyyMmDd}
                    className="mt-1 w-full rounded-md border bg-white px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-xs font-medium text-zinc-600">
                  To
                  <DateInput
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                    max={todayYyyyMmDd}
                    className="mt-1 w-full rounded-md border bg-white px-2 py-1.5 text-sm"
                  />
                </label>
              </div>
              <ActionButton
                type="button"
                onClick={() => {
                  setDateFrom(defaultDateRange.from);
                  setDateTo(defaultDateRange.to);
                }}
                disabled={dateFrom === defaultDateRange.from && dateTo === defaultDateRange.to}
                variant="secondary"
                size="sm"
                className="self-end text-sm font-normal text-amber-800 hover:text-amber-900"
                iconColor="amber"
              >
                <FilterX className="h-3.5 w-3.5" />
                Clear filters
              </ActionButton>
            </div>
            <WorkoutActivityChart
              data={workoutActivityData}
              isCompactView={isSmallPhone}
              highlightedDates={highlightedActivityDates}
              onHighlightDatesChange={setHighlightedActivityDates}
            />
          <SessionsTable
            rows={completedTableRows}
            dateHeaderLabel="Performed on"
            emptyMessage="No completed workout sessions in the selected timeframe."
            showNotesColumn={!isSmallPhone}
            compactMode={isSmallPhone}
            openingRowId={openingSessionId}
            highlightedPerformedOnDates={highlightedActivityDates}
            onOpenRow={(rowId) => {
              if (openingSessionId) {
                return;
              }
              setOpeningSessionId(rowId);
              router.push(`/sessions/${rowId}`);
            }}
          />
          </div>
        )}
      </section>
      <section className="panel p-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-base font-medium text-zinc-800">Planned workouts</h2>
        </div>
        {plannedSessions.length === 0 ? (
          <p className="text-sm text-zinc-500">No planned workouts.</p>
        ) : (
          <SessionsTable
            rows={plannedTableRows}
            dateHeaderLabel="Planned on"
            emptyMessage="No planned workouts."
            showNotesColumn={!isSmallPhone}
            compactMode={isSmallPhone}
            openingRowId={openingSessionId}
            highlightedPerformedOnDates={highlightedActivityDates}
            onOpenRow={(rowId) => {
              if (openingSessionId) {
                return;
              }
              setOpeningSessionId(rowId);
              router.push(`/sessions/${rowId}`);
            }}
          />
        )}
      </section>
    </PageShell>
  );
}
