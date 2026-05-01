import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type InsightsRange = "4w" | "12w" | "6m" | "all";

type WorkoutSessionRow = {
  id: string;
  performed_on: string;
};

type SessionExerciseRow = {
  id: string;
  session_id: string;
};

type WorkoutSetLinkRow = {
  session_exercise_id: string | null;
  weight_kg: number | null;
};

export type WorkoutActivityPoint = {
  date: string;
  workouts: number;
  sets: number;
  loadedKg: number;
};

function toYyyyMmDd(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateOnly(value: string): string {
  return value.slice(0, 10);
}

function getRangeStart(range: InsightsRange, today: Date): string | null {
  const start = new Date(today);
  if (range === "4w") {
    start.setDate(start.getDate() - 27);
    return toYyyyMmDd(start);
  }
  if (range === "12w") {
    start.setDate(start.getDate() - 83);
    return toYyyyMmDd(start);
  }
  if (range === "6m") {
    start.setMonth(start.getMonth() - 6);
    return toYyyyMmDd(start);
  }
  return null;
}

export async function loadUserWorkoutActivityBase(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<WorkoutActivityPoint[]> {
  const { data: sessionsData, error: sessionsError } = await client
    .from("workout_sessions")
    .select("id, performed_on")
    .eq("user_id", userId);
  if (sessionsError) {
    throw new Error(`Could not load workout sessions: ${sessionsError.message}`);
  }

  const sessions = (sessionsData ?? []) as WorkoutSessionRow[];
  const sessionIds = sessions.map((row) => row.id);
  const setsBySessionId = new Map<string, number>();
  const loadedKgBySessionId = new Map<string, number>();

  if (sessionIds.length > 0) {
    const { data: sessionExercisesData, error: sessionExercisesError } = await client
      .from("workout_session_exercises")
      .select("id, session_id")
      .in("session_id", sessionIds);
    if (sessionExercisesError) {
      throw new Error(`Could not load session exercises: ${sessionExercisesError.message}`);
    }
    const sessionExercises = (sessionExercisesData ?? []) as SessionExerciseRow[];
    const sessionExerciseIds = sessionExercises.map((row) => row.id);
    const sessionIdBySessionExerciseId = new Map<string, string>();
    for (const row of sessionExercises) {
      sessionIdBySessionExerciseId.set(row.id, row.session_id);
    }

    if (sessionExerciseIds.length > 0) {
      const { data: setsData, error: setsError } = await client
        .from("workout_sets")
        .select("session_exercise_id, weight_kg")
        .in("session_exercise_id", sessionExerciseIds);
      if (setsError) {
        throw new Error(`Could not load workout sets: ${setsError.message}`);
      }
      for (const row of (setsData ?? []) as WorkoutSetLinkRow[]) {
        if (!row.session_exercise_id) {
          continue;
        }
        const sessionId = sessionIdBySessionExerciseId.get(row.session_exercise_id);
        if (!sessionId) {
          continue;
        }
        setsBySessionId.set(sessionId, (setsBySessionId.get(sessionId) ?? 0) + 1);
        loadedKgBySessionId.set(sessionId, (loadedKgBySessionId.get(sessionId) ?? 0) + (row.weight_kg ?? 0));
      }
    }
  }

  const aggregateByDate = new Map<string, { workouts: number; sets: number; loadedKg: number }>();
  for (const session of sessions) {
    const date = normalizeDateOnly(session.performed_on);
    const current = aggregateByDate.get(date) ?? { workouts: 0, sets: 0, loadedKg: 0 };
    current.workouts += 1;
    current.sets += setsBySessionId.get(session.id) ?? 0;
    current.loadedKg += loadedKgBySessionId.get(session.id) ?? 0;
    aggregateByDate.set(date, current);
  }

  return [...aggregateByDate.entries()]
    .map(([date, value]) => ({
      date,
      workouts: value.workouts,
      sets: value.sets,
      loadedKg: value.loadedKg,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function applyInsightsRange(
  points: WorkoutActivityPoint[],
  range: InsightsRange,
): WorkoutActivityPoint[] {
  if (points.length === 0) {
    return [];
  }
  const today = new Date();
  const todayKey = toYyyyMmDd(today);
  const start = getRangeStart(range, today);
  return points.filter((point) => {
    if (point.date > todayKey) {
      return false;
    }
    if (!start) {
      return true;
    }
    return point.date >= start;
  });
}
