import type { ExerciseDraftRow } from "@/lib/workout-exercise-draft";
import { createEmptyExerciseRow } from "@/lib/workout-exercise-draft";

export const NEW_SESSION_DRAFT_STORAGE_PREFIX = "evolift:new-session-draft";

export function getNewSessionDraftStorageKey(userId: string): string {
  return `${NEW_SESSION_DRAFT_STORAGE_PREFIX}:${userId}`;
}

export type NewSessionDraftStored = {
  performedOn: string;
  notes: string;
  exerciseRows: ExerciseDraftRow[];
  /** ISO timestamp for “last edited” / relative time in UI */
  updatedAt?: string;
};

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseExerciseDraftRowLoose(item: unknown): ExerciseDraftRow | null {
  if (!item || typeof item !== "object") {
    return null;
  }
  const r = item as Record<string, unknown>;
  const rowIdRaw = r.rowId;
  const exerciseId = asTrimmedString(r.exerciseId);
  const rowId =
    typeof rowIdRaw === "string" && rowIdRaw.trim().length > 0
      ? rowIdRaw
      : `restored-row-${Math.random().toString(36).slice(2, 10)}`;
  return {
    rowId,
    exerciseId,
    baseWeightKg: asTrimmedString(r.baseWeightKg),
    targetSets: asTrimmedString(r.targetSets),
    targetReps: asTrimmedString(r.targetReps),
    targetWeightKg: asTrimmedString(r.targetWeightKg),
    notes: asTrimmedString(r.notes),
  };
}

/**
 * Parse and validate draft JSON from localStorage. Returns null if missing or invalid.
 */
export function parseNewSessionDraftFromStorage(raw: string | null): NewSessionDraftStored | null {
  if (raw == null || !raw.trim()) {
    return null;
  }
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") {
      return null;
    }
    const d = data as Record<string, unknown>;
    if (typeof d.performedOn !== "string" || typeof d.notes !== "string") {
      return null;
    }
    if (!Array.isArray(d.exerciseRows)) {
      return null;
    }
    const exerciseRows: ExerciseDraftRow[] = [];
    for (const item of d.exerciseRows) {
      const row = parseExerciseDraftRowLoose(item);
      if (row) {
        exerciseRows.push(row);
      }
    }
    const updatedAt = d.updatedAt;
    return {
      performedOn: d.performedOn,
      notes: d.notes,
      exerciseRows,
      updatedAt: typeof updatedAt === "string" && updatedAt.trim() ? updatedAt : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Whether the draft is worth surfacing (resume / home callout). Matches empty “new” form:
 * today only, no notes, single empty exercise row is not meaningful.
 */
export function isMeaningfulNewSessionDraft(
  draft: NewSessionDraftStored,
  options: { todayYyyyMmDd: string },
): boolean {
  if (draft.notes.trim().length > 0) {
    return true;
  }
  if (draft.exerciseRows.some((row) => row.exerciseId.trim().length > 0)) {
    return true;
  }
  const performed = draft.performedOn.trim().slice(0, 10);
  return performed.length > 0 && performed !== options.todayYyyyMmDd;
}

/** Human-readable “last edited” for banner copy; empty string if `iso` is invalid. */
export function formatRelativePastFromIso(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) {
    return "";
  }
  const seconds = Math.round((t - Date.now()) / 1000);
  const divisions: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
    { amount: 60, unit: "second" },
    { amount: 60, unit: "minute" },
    { amount: 24, unit: "hour" },
    { amount: 7, unit: "day" },
    { amount: 4.34524, unit: "week" },
    { amount: 12, unit: "month" },
    { amount: Number.POSITIVE_INFINITY, unit: "year" },
  ];
  let duration = seconds;
  let unit: Intl.RelativeTimeFormatUnit = "second";
  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      break;
    }
    duration /= division.amount;
    unit = division.unit;
  }
  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
    Math.round(duration),
    unit,
  );
}

export function buildNewSessionDraftPayload(
  performedOn: string,
  notes: string,
  exerciseRows: ExerciseDraftRow[],
): NewSessionDraftStored {
  return {
    performedOn,
    notes,
    exerciseRows,
    updatedAt: new Date().toISOString(),
  };
}

/** Rows safe to put in React state (at least one row). */
export function normalizeExerciseRowsForHydrate(rows: ExerciseDraftRow[]): ExerciseDraftRow[] {
  if (rows.length === 0) {
    return [createEmptyExerciseRow()];
  }
  return rows;
}

/** Same-tab listeners (e.g. home callout) after discard or successful create. */
export const NEW_SESSION_DRAFT_CHANGED_EVENT = "evolift:new-session-draft-changed";

export function notifyNewSessionDraftChanged(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(NEW_SESSION_DRAFT_CHANGED_EVENT));
}
