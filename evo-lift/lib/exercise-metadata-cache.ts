import type { SupabaseClient } from "@supabase/supabase-js";

type ExerciseMetadataRow = {
  id: string;
  slug: string;
  label: string;
};

type ExerciseRow = {
  id: string;
  slug: string;
};

type TranslationRow = {
  exercise_id: string;
  name: string;
};

type ExerciseMetadataCachePayload = {
  fetchedAt: number;
  rows: ExerciseMetadataRow[];
};

const EXERCISE_METADATA_CACHE_KEY = "evolift:exercise-metadata:v1";
const DEFAULT_TTL_MS = 5 * 60 * 1000;

let inMemoryCache: ExerciseMetadataCachePayload | null = null;

export type ExerciseMetadataCacheStatus = "hit-memory" | "hit-local" | "miss";

function canUseWindow(): boolean {
  return typeof window !== "undefined";
}

function readLocalCache(): ExerciseMetadataCachePayload | null {
  if (!canUseWindow()) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(EXERCISE_METADATA_CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as ExerciseMetadataCachePayload;
    if (!Array.isArray(parsed.rows) || typeof parsed.fetchedAt !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeLocalCache(payload: ExerciseMetadataCachePayload) {
  if (!canUseWindow()) {
    return;
  }
  try {
    window.localStorage.setItem(EXERCISE_METADATA_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota/storage errors; cache is optional.
  }
}

function isFresh(payload: ExerciseMetadataCachePayload, ttlMs: number): boolean {
  return Date.now() - payload.fetchedAt <= ttlMs;
}

export function getExerciseMetadataCacheStatus(ttlMs = DEFAULT_TTL_MS): ExerciseMetadataCacheStatus {
  if (inMemoryCache && isFresh(inMemoryCache, ttlMs)) {
    return "hit-memory";
  }
  const local = readLocalCache();
  if (local && isFresh(local, ttlMs)) {
    return "hit-local";
  }
  return "miss";
}

export function invalidateExerciseMetadataCache() {
  inMemoryCache = null;
  if (!canUseWindow()) {
    return;
  }
  try {
    window.localStorage.removeItem(EXERCISE_METADATA_CACHE_KEY);
  } catch {
    // ignore
  }
}

export async function loadExerciseMetadata(
  client: SupabaseClient,
  options?: { ttlMs?: number; forceRefresh?: boolean },
): Promise<ExerciseMetadataRow[]> {
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  if (!options?.forceRefresh && inMemoryCache && isFresh(inMemoryCache, ttlMs)) {
    return inMemoryCache.rows;
  }

  if (!options?.forceRefresh) {
    const local = readLocalCache();
    if (local && isFresh(local, ttlMs)) {
      inMemoryCache = local;
      return local.rows;
    }
  }

  const { data: exerciseRows, error: exerciseError } = await client
    .from("exercises")
    .select("id, slug")
    .order("slug", { ascending: true });
  if (exerciseError) {
    throw new Error("Could not load exercises.");
  }

  const typedExercises = (exerciseRows ?? []) as ExerciseRow[];
  const exerciseIds = typedExercises.map((item) => item.id);
  let translations: TranslationRow[] = [];
  if (exerciseIds.length > 0) {
    const { data: translationRows, error: translationError } = await client
      .from("exercise_translations")
      .select("exercise_id, name")
      .eq("lang_code", "en")
      .in("exercise_id", exerciseIds);
    if (translationError) {
      throw new Error("Could not load exercise labels.");
    }
    translations = (translationRows ?? []) as TranslationRow[];
  }

  const labelByExerciseId = new Map<string, string>();
  for (const row of translations) {
    labelByExerciseId.set(row.exercise_id, row.name);
  }
  const rows = typedExercises.map((row) => ({
    id: row.id,
    slug: row.slug,
    label: labelByExerciseId.get(row.id) ?? row.slug,
  }));

  const payload: ExerciseMetadataCachePayload = {
    fetchedAt: Date.now(),
    rows,
  };
  inMemoryCache = payload;
  writeLocalCache(payload);
  return rows;
}
