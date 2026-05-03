/**
 * Calendar day for a session (YYYY-MM-DD). Matches home planned vs completed split when
 * Supabase returns date-only or datetime strings.
 */
export function normalizeSessionDateOnly(value: string): string {
  return value.slice(0, 10);
}

export function getTodayYyyyMmDd(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = `${today.getMonth() + 1}`.padStart(2, "0");
  const day = `${today.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** True when performed_on is after today (planned), consistent with session detail "Planned" and home. */
export function isFutureSessionDate(performedOn: string): boolean {
  return normalizeSessionDateOnly(performedOn) > getTodayYyyyMmDd();
}
