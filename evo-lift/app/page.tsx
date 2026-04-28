"use client";

import { ClipboardList } from "lucide-react";
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

export default function Home() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [sessions, setSessions] = useState<WorkoutSessionRow[]>([]);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
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

  const sortedSessions = useMemo(() => {
    const sorted = [...sessions];
    sorted.sort((a, b) => {
      let left: number | string = "";
      let right: number | string = "";

      if (sortKey === "number") {
        left = Date.parse(a.created_at);
        right = Date.parse(b.created_at);
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
  }, [sessions, sortDirection, sortKey]);

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
      <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <ClipboardList className="h-6 w-6 text-amber-700" />
        Workout sessions
      </h1>
      <section className="panel p-5">
        {sessionsError ? (
          <p className="text-sm text-red-600">{sessionsError}</p>
        ) : (
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
                      No workout sessions are stored yet.{" "}
                      <a
                        href="/sessions/new"
                        className="font-medium underline"
                      >
                        Start tracking
                      </a>
                    </td>
                  </tr>
                ) : (
                  sortedSessions.map((session, index) => {
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
                      <td className="px-2 py-2">{index + 1}</td>
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
        )}
      </section>
    </main>
  );
}
