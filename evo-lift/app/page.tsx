"use client";

import Link from "next/link";
import { ClipboardList, FilterX, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import { toExerciseBadge } from "@/lib/exercise-badge";

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

type ExerciseRow = {
  id: string;
  slug: string;
};

type SessionExerciseBadge = {
  slug: string;
  hasLoggedSet: boolean;
};

type SortKey = "number" | "performed_on" | "notes";
type SortDirection = "asc" | "desc";

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

export default function Home() {
  const router = useRouter();
  const defaultDateRange = useMemo(() => getDefaultDateRange(), []);
  const pageSize = 20;
  const [isChecking, setIsChecking] = useState(true);
  const [sessions, setSessions] = useState<WorkoutSessionRow[]>([]);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(defaultDateRange.from);
  const [dateTo, setDateTo] = useState(defaultDateRange.to);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("performed_on");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedNotesIds, setExpandedNotesIds] = useState<Set<string>>(new Set());
  const [openingSessionId, setOpeningSessionId] = useState<string | null>(null);
  const [exerciseBadgesBySessionId, setExerciseBadgesBySessionId] = useState<
    Map<string, SessionExerciseBadge[]>
  >(new Map());

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

          for (const row of setsData ?? []) {
            if (row.session_exercise_id) {
              sessionExerciseIdsWithSets.add(row.session_exercise_id);
            }
          }
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
      }

      setIsChecking(false);
    }

    void checkSession();

    return () => {
      isMounted = false;
    };
  }, [router]);

  function handleSort(column: SortKey) {
    if (sortKey === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(column);
    setSortDirection(column === "performed_on" ? "desc" : "asc");
  }

  function toggleExpandedNotes(id: string) {
    setExpandedNotesIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const sessionNumberById = useMemo(() => {
    const byCreatedAtAsc = [...sessions].sort(
      (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
    );
    const numberMap = new Map<string, number>();
    byCreatedAtAsc.forEach((session, index) => {
      numberMap.set(session.id, index + 1);
    });
    return numberMap;
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const performedOn = normalizeDateOnly(session.performed_on);
      if (dateFrom && performedOn < dateFrom) {
        return false;
      }
      if (dateTo && performedOn > dateTo) {
        return false;
      }
      return true;
    });
  }, [dateFrom, dateTo, sessions]);

  const sortedSessions = useMemo(() => {
    const sorted = [...filteredSessions];
    sorted.sort((a, b) => {
      let left: number | string = "";
      let right: number | string = "";

      if (sortKey === "number") {
        left = sessionNumberById.get(a.id) ?? 0;
        right = sessionNumberById.get(b.id) ?? 0;
      } else if (sortKey === "performed_on") {
        left = a.performed_on;
        right = b.performed_on;
      } else {
        left = a.notes ?? "";
        right = b.notes ?? "";
      }

      if (left < right) {
        return sortDirection === "asc" ? -1 : 1;
      }
      if (left > right) {
        return sortDirection === "asc" ? 1 : -1;
      }
      return 0;
    });
    return sorted;
  }, [filteredSessions, sessionNumberById, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedSessions.length / pageSize));

  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedSessions.slice(start, start + pageSize);
  }, [currentPage, pageSize, sortedSessions]);

  useEffect(() => {
    setCurrentPage(1);
  }, [dateFrom, dateTo, sortDirection, sortKey]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  function renderSortIndicator(column: SortKey) {
    if (sortKey !== column) {
      return <span className="text-zinc-400">-</span>;
    }
    return <span>{sortDirection === "asc" ? "↑" : "↓"}</span>;
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
          <ClipboardList className="h-6 w-6 text-sky-700" />
          Workout sessions
        </h1>
        <Link
          href="/sessions/new"
          className="inline-flex h-10 items-center justify-center gap-1 rounded-md border border-sky-700 bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:border-sky-600 hover:bg-sky-600"
          aria-label="Add workout session"
          title="Add workout session"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Add workout session</span>
        </Link>
      </div>
      <section className="panel p-5">
        {sessionsError ? (
          <p className="text-sm text-red-600">{sessionsError}</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-xs font-medium text-zinc-600">
                  From
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                    className="mt-1 w-full rounded-md border bg-white px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-xs font-medium text-zinc-600">
                  To
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                    className="mt-1 w-full rounded-md border bg-white px-2 py-1.5 text-sm"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                disabled={!dateFrom && !dateTo}
                className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-3 text-sm text-zinc-800 hover:border-sky-300 hover:bg-zinc-100 disabled:opacity-60"
              >
                <FilterX className="h-3.5 w-3.5" />
                Clear filters
              </button>
            </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-full text-left text-sm md:min-w-[520px]">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 font-medium">
                    <button
                      type="button"
                      onClick={() => handleSort("number")}
                      className="inline-flex items-center gap-1"
                    >
                      No. {renderSortIndicator("number")}
                    </button>
                  </th>
                  <th className="px-2 py-2 font-medium">
                    <button
                      type="button"
                      onClick={() => handleSort("performed_on")}
                      className="inline-flex items-center gap-1"
                    >
                      Performed on {renderSortIndicator("performed_on")}
                    </button>
                  </th>
                  <th className="px-2 py-2 font-medium">Exercises</th>
                  <th className="hidden px-2 py-2 font-medium md:table-cell">
                    <button
                      type="button"
                      onClick={() => handleSort("notes")}
                      className="inline-flex items-center gap-1"
                    >
                      Notes {renderSortIndicator("notes")}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedSessions.length === 0 ? (
                  <tr>
                    <td className="break-words whitespace-normal px-2 py-4 text-zinc-600" colSpan={2}>
                      No workout sessions are stored yet.
                    </td>
                  </tr>
                ) : (
                  paginatedSessions.map((session) => {
                    const notes = session.notes ?? "";
                    const isExpanded = expandedNotesIds.has(session.id);
                    const needsTruncate = notes.length > 64;
                    const visibleNotes =
                      needsTruncate && !isExpanded ? `${notes.slice(0, 64)}[...]` : notes || "-";
                    const isOpening = openingSessionId === session.id;

                    return (
                    <tr
                      key={session.id}
                      className={`border-b last:border-b-0 ${
                        isOpening
                          ? "cursor-progress bg-sky-100"
                          : "cursor-pointer hover:bg-sky-50"
                      }`}
                      onClick={() => {
                        if (openingSessionId) {
                          return;
                        }
                        setOpeningSessionId(session.id);
                        router.push(`/sessions/${session.id}`);
                      }}
                    >
                      <td className="px-2 py-2">{sessionNumberById.get(session.id) ?? "-"}</td>
                      <td className="px-2 py-2">
                        <span className="inline-flex items-center gap-2">
                          {session.performed_on}
                          {isOpening ? (
                            <span className="text-xs font-medium text-sky-700">Opening...</span>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap items-center gap-1">
                          {(exerciseBadgesBySessionId.get(session.id) ?? []).slice(0, 8).map((item, index) => {
                            return (
                              <span
                                key={`${session.id}-${item.slug}-${index}`}
                                className={`inline-flex h-6 min-w-8 items-center justify-center rounded border px-1 text-[10px] font-semibold tracking-wide ${
                                  item.hasLoggedSet
                                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                    : "border-zinc-300 bg-zinc-50 text-zinc-700"
                                }`}
                                title={`${item.slug}${item.hasLoggedSet ? " (set logged)" : " (no sets yet)"}`}
                                aria-label={item.slug}
                              >
                                {toExerciseBadge(item.slug)}
                              </span>
                            );
                          })}
                          {(exerciseBadgesBySessionId.get(session.id) ?? []).length === 0 ? (
                            <span className="text-zinc-500">-</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="hidden px-2 py-2 md:table-cell">
                        <span>{visibleNotes}</span>
                        {needsTruncate ? (
                          <button
                            type="button"
                            className="ml-2 text-xs underline"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleExpandedNotes(session.id);
                            }}
                          >
                            {isExpanded ? "[less]" : "[...]"}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {sortedSessions.length > 0 ? (
            <div className="flex items-center justify-between pt-3 text-sm">
              <p className="text-zinc-600">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-300 bg-zinc-50 px-3 text-zinc-800 hover:border-sky-300 hover:bg-zinc-100 disabled:opacity-60"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-sky-700 bg-sky-700 px-3 text-white hover:border-sky-600 hover:bg-sky-600 disabled:opacity-60"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
