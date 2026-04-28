"use client";

import Link from "next/link";
import { ClipboardList, FilterX, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/browser";

type WorkoutSessionRow = {
  id: string;
  performed_on: string;
  notes: string | null;
  created_at: string;
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

      setSessions((data ?? []) as WorkoutSessionRow[]);
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
      if (dateFrom && session.performed_on < dateFrom) {
        return false;
      }
      if (dateTo && session.performed_on > dateTo) {
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
          <ClipboardList className="h-6 w-6 text-amber-700" />
          Workout sessions
        </h1>
        <Link
          href="/sessions/new"
          className="inline-flex h-10 items-center justify-center gap-1 rounded-md border px-3 py-2 text-sm font-medium hover:border-amber-500 hover:bg-amber-100 hover:text-amber-700"
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
                className="inline-flex h-9 items-center justify-center gap-1 rounded-md border px-3 text-sm disabled:opacity-60"
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

                    return (
                    <tr
                      key={session.id}
                      className="cursor-pointer border-b last:border-b-0 hover:bg-amber-50"
                      onClick={() => router.push(`/sessions/${session.id}`)}
                    >
                      <td className="px-2 py-2">{sessionNumberById.get(session.id) ?? "-"}</td>
                      <td className="px-2 py-2">{session.performed_on}</td>
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
                  className="inline-flex h-9 items-center justify-center rounded-md border px-3 disabled:opacity-60"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex h-9 items-center justify-center rounded-md border px-3 disabled:opacity-60"
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
