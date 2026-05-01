# Page Load Performance Baseline and Deltas

## Scope

- `app/sessions/[id]/page.tsx`
- `app/exercises/[slug]/page.tsx`
- `app/exercises/page.tsx`

## Instrumentation Added

- Shared tracker: `lib/page-load-perf.ts`
  - Captures total page load duration (client-side fetch flow).
  - Captures query count and per-query latency.
  - Logs a compact summary in the browser console.
  - Stores recent samples on `window.__evoLiftPerfMetrics`.
- Instrumented query wrappers were added to each scoped page load flow.

## Cache Strategy

- Shared exercise metadata cache: `lib/exercise-metadata-cache.ts`
  - Cached data: `exercises (id, slug)` + English label from `exercise_translations`.
  - Cache locations:
    - in-memory module cache (fast intra-session reuse),
    - `localStorage` key: `evolift:exercise-metadata:v1` (cross-page reuse).
  - TTL: 5 minutes.
  - Invalidation:
    - TTL expiry (automatic refresh),
    - explicit `invalidateExerciseMetadataCache()` hook for future metadata mutations.
- Safety:
  - Only stable exercise metadata is cached (not user workout/session data).
  - User-scoped data remains fetched directly and auth-gated.

## Baseline (Before Optimization)

Measured as query flow counts from previous page-load logic.

| Page | Query count (baseline) | Main bottlenecks |
|---|---:|---|
| `/sessions/[id]` | 8 | Repeated metadata fetch (`exercises` + `exercise_translations`) on every load |
| `/exercises/[slug]` | 6 | Separate exercise/translation lookup + full session chain each load |
| `/exercises` | 5 | Re-fetching metadata every load |

## Post-change (After Optimization)

### Cold cache (first load after TTL miss)

| Page | Query count (after, cold) | Delta vs baseline |
|---|---:|---:|
| `/sessions/[id]` | 8 | 0 |
| `/exercises/[slug]` | 5 | -1 |
| `/exercises` | 4 | -1 |

### Warm cache (within TTL)

| Page | Query count (after, warm) | Delta vs baseline |
|---|---:|---:|
| `/sessions/[id]` | 6 | -2 |
| `/exercises/[slug]` | 4 | -2 |
| `/exercises` | 3 | -2 |

## What Changed

- Added reusable exercise metadata cache and replaced duplicate metadata fetches in all three scoped pages.
- Added query-level and total-load instrumentation wrappers for the scoped page loads.
- Tightened one redundant page flow in `app/exercises/[slug]/page.tsx` by resolving exercise identity/label from cached metadata instead of separate queries.

## Known Trade-offs

- Cold-cache first hit still performs metadata queries.
- Metadata can be stale for up to 5 minutes; this is acceptable for non-critical exercise naming/slug metadata.
- Session number computation in `/sessions/[id]` still scans user session ids; this remains unchanged for behavior safety.

## Next Steps (Optional)

- Add a tiny dev-only diagnostics panel to inspect `window.__evoLiftPerfMetrics` without opening console.
- Optimize `/sessions/[id]` session number lookup with a focused count strategy if needed.
- Add explicit metadata cache invalidation wherever exercise definitions/translations are edited in-app.
