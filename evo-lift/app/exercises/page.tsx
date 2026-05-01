"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Weight } from "lucide-react";
import { PageShell } from "@/app/components/page-shell";
import { StatusNotice } from "@/app/components/status-notice";
import { loadExerciseMetadata } from "@/lib/exercise-metadata-cache";
import { createPageLoadPerfTracker } from "@/lib/page-load-perf";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import { toExerciseBadge } from "@/lib/exercise-badge";

type ExerciseRow = {
  id: string;
  slug: string;
};

type TranslationRow = {
  exercise_id: string;
  name: string;
};

type SessionIdRow = {
  id: string;
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

export default function ExercisesPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [exercises, setExercises] = useState<ExerciseListItem[]>([]);

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
            .select("id")
            .eq("user_id", session.user.id),
      );
      if (sessionsError) {
        setErrorMessage("Could not load your workout sessions.");
        setIsLoading(false);
        perf.flush();
        return;
      }

      const sessionIds = ((sessionRows ?? []) as SessionIdRow[]).map((row) => row.id);
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

  const exercisesWithHistory = useMemo(
    () => exercises.filter((item) => item.sessionCount > 0),
    [exercises],
  );

  return (
    <PageShell>
      <div className="flex items-center justify-between gap-3">
        <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Weight className="h-6 w-6 text-sky-700" />
          Exercises
        </h1>
      </div>

      <section className="rounded-md border border-zinc-200 bg-white p-4 sm:p-5">
        <p className="mb-3 text-sm text-zinc-600">
          Open an exercise to review your full set history.
        </p>
        {errorMessage ? (
          <StatusNotice message={errorMessage} tone="error" />
        ) : isLoading ? (
          <p className="text-sm text-zinc-600">Loading exercises...</p>
        ) : exercisesWithHistory.length === 0 ? (
          <p className="text-sm text-zinc-600">
            No exercise history yet. Log a workout session to see exercises here.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {exercisesWithHistory.map((exercise) => (
              <Link
                key={exercise.id}
                href={`/exercises/${exercise.slug}`}
                className="inline-flex items-center justify-between gap-2 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 hover:border-sky-300 hover:bg-sky-50"
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <span className="inline-flex h-6 min-w-8 shrink-0 items-center justify-center rounded border border-zinc-300 bg-white px-1 text-[10px] font-semibold tracking-wide text-zinc-700">
                    {toExerciseBadge(exercise.slug)}
                  </span>
                  <span className="truncate">{exercise.label}</span>
                </span>
                <span className="shrink-0 text-xs text-zinc-500">
                  {exercise.sessionCount} {exercise.sessionCount === 1 ? "session" : "sessions"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
