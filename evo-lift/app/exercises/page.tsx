"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { History, LayoutGrid, Weight } from "lucide-react";
import { ExerciseBadgeChip } from "@/app/components/exercise-badge-chip";
import { ExerciseFilteredList } from "@/app/components/exercise-filtered-list";
import { PageShell } from "@/app/components/page-shell";
import { StatusNotice } from "@/app/components/status-notice";
import { loadExerciseMetadata } from "@/lib/exercise-metadata-cache";
import { createPageLoadPerfTracker } from "@/lib/page-load-perf";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import { isFutureSessionDate } from "@/lib/session-date";
import { useDebouncedValue } from "@/lib/use-debounced-value";

type SessionIdRow = {
  id: string;
  performed_on: string;
};

type SessionExerciseRow = {
  exercise_id: string;
};

type ExerciseListItem = {
  id: string;
  slug: string;
  label: string;
  sessionCount: number;
};

function ExercisesMain() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [exercises, setExercises] = useState<ExerciseListItem[]>([]);
  const [searchText, setSearchText] = useState("");

  const scopeAll = searchParams.get("scope") === "all";

  useEffect(() => {
    setSearchText(searchParams.get("q") ?? "");
  }, [searchParams]);

  const debouncedSearch = useDebouncedValue(searchText, 280);

  useEffect(() => {
    const fromUrl = searchParams.get("q")?.trim() ?? "";
    const next = debouncedSearch.trim();
    if (next === fromUrl) {
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set("q", next);
    } else {
      params.delete("q");
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [debouncedSearch, pathname, router, searchParams]);

  useEffect(() => {
    let isMounted = true;
    const perf = createPageLoadPerfTracker("/exercises");

    async function loadData() {
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

      let cachedMetadata: Array<{ id: string; slug: string; label: string }> = [];
      try {
        cachedMetadata = await perf.trackQuery("exerciseMetadata.load", () =>
          loadExerciseMetadata(supabaseBrowserClient, { ttlMs: 5 * 60 * 1000 }),
        );
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Could not load exercises.");
        setIsLoading(false);
        perf.flush();
        return;
      }

      const { data: sessionRows, error: sessionsError } = await perf.trackQuery(
        "workout_sessions.selectUserIds",
        async () =>
          await supabaseBrowserClient
            .from("workout_sessions")
            .select("id, performed_on")
            .eq("user_id", session.user.id),
      );
      if (sessionsError) {
        setErrorMessage("Could not load your workout sessions.");
        setIsLoading(false);
        perf.flush();
        return;
      }

      const sessionIds = ((sessionRows ?? []) as SessionIdRow[])
        .filter((row) => !isFutureSessionDate(row.performed_on))
        .map((row) => row.id);
      const exerciseCountById = new Map<string, number>();
      if (sessionIds.length > 0) {
        const { data: sessionExerciseRows, error: sessionExercisesError } = await perf.trackQuery(
          "workout_session_exercises.selectBySessionIds",
          async () =>
            await supabaseBrowserClient
              .from("workout_session_exercises")
              .select("exercise_id")
              .in("session_id", sessionIds),
        );
        if (sessionExercisesError) {
          setErrorMessage("Could not load exercise history.");
          setIsLoading(false);
          perf.flush();
          return;
        }
        for (const row of (sessionExerciseRows ?? []) as SessionExerciseRow[]) {
          exerciseCountById.set(row.exercise_id, (exerciseCountById.get(row.exercise_id) ?? 0) + 1);
        }
      }

      const nextItems = cachedMetadata.map((row) => ({
        id: row.id,
        slug: row.slug,
        label: row.label,
        sessionCount: exerciseCountById.get(row.id) ?? 0,
      }));

      setExercises(nextItems);
      setIsLoading(false);
      perf.flush();
    }

    void loadData();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const displayItems = useMemo(
    () => (scopeAll ? exercises : exercises.filter((item) => item.sessionCount > 0)),
    [exercises, scopeAll],
  );

  function setScope(next: "used" | "all") {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") {
      params.set("scope", "all");
    } else {
      params.delete("scope");
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const pillBase =
    "rounded-md border px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40";
  const pillActive = "border-sky-600 bg-sky-100 text-sky-950";
  const pillInactive = "border-zinc-300 bg-zinc-50 text-zinc-700 hover:border-zinc-400 hover:bg-zinc-100";

  return (
    <section className="rounded-md border border-zinc-200 bg-white p-4 sm:p-5">
      <p className="mb-3 text-sm text-zinc-600">
        Open an exercise to review your full set history.
      </p>
      {errorMessage ? (
        <StatusNotice message={errorMessage} tone="error" />
      ) : isLoading ? (
        <p className="text-sm text-zinc-600">Loading exercises...</p>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setScope("used")}
              className={`flex w-full flex-col items-center justify-center gap-1.5 text-center leading-tight ${pillBase} ${!scopeAll ? pillActive : pillInactive}`}
            >
              <History className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              <span>With session history</span>
            </button>
            <button
              type="button"
              onClick={() => setScope("all")}
              className={`flex w-full flex-col items-center justify-center gap-1.5 text-center leading-tight ${pillBase} ${scopeAll ? pillActive : pillInactive}`}
            >
              <LayoutGrid className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              <span>All exercises</span>
            </button>
          </div>
          {displayItems.length === 0 ? (
            <p className="text-sm text-zinc-600">
              {scopeAll
                ? "No exercises loaded."
                : 'No exercise history yet. Choose "All exercises" above, or log a workout session first.'}
            </p>
          ) : (
            <ExerciseFilteredList
              items={displayItems}
              searchText={searchText}
              onSearchTextChange={setSearchText}
              filterLabel="Search exercises"
              searchPlaceholder="Search by name or badge"
              emptyFilterMessage="No exercises match that search."
              listClassName="mt-3 max-h-[min(24rem,55vh)] space-y-2 overflow-y-auto overscroll-y-contain rounded-md border border-zinc-200 bg-zinc-50/80 p-3 sm:grid sm:grid-cols-2 sm:gap-2 sm:space-y-0"
              renderItem={(exercise) => (
                <Link
                  href={`/exercises/${exercise.slug}`}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 hover:border-sky-300 hover:bg-sky-50"
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <ExerciseBadgeChip slug={exercise.slug} />
                    <span className="truncate">{exercise.label}</span>
                  </span>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {exercise.sessionCount}{" "}
                    {exercise.sessionCount === 1 ? "session" : "sessions"}
                  </span>
                </Link>
              )}
            />
          )}
        </>
      )}
    </section>
  );
}

export default function ExercisesPage() {
  return (
    <PageShell>
      <div className="flex items-center justify-between gap-3">
        <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Weight className="h-6 w-6 text-sky-700" />
          Exercises
        </h1>
      </div>

      <Suspense
        fallback={
          <section className="rounded-md border border-zinc-200 bg-white p-4 sm:p-5">
            <p className="text-sm text-zinc-600">Loading exercises...</p>
          </section>
        }
      >
        <ExercisesMain />
      </Suspense>
    </PageShell>
  );
}
