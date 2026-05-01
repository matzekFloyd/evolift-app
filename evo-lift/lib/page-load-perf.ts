type PerfQueryMetric = {
  name: string;
  durationMs: number;
};

type PerfFlushResult = {
  page: string;
  loadDurationMs: number;
  queryCount: number;
  queries: PerfQueryMetric[];
};

declare global {
  interface Window {
    __evoLiftPerfMetrics?: PerfFlushResult[];
  }
}

export function createPageLoadPerfTracker(page: string) {
  const loadStartedAt = performance.now();
  const queries: PerfQueryMetric[] = [];

  async function trackQuery<T>(name: string, run: () => PromiseLike<T> | T): Promise<T> {
    const startedAt = performance.now();
    try {
      return await run();
    } finally {
      queries.push({
        name,
        durationMs: Number((performance.now() - startedAt).toFixed(1)),
      });
    }
  }

  function flush() {
    const payload: PerfFlushResult = {
      page,
      loadDurationMs: Number((performance.now() - loadStartedAt).toFixed(1)),
      queryCount: queries.length,
      queries: [...queries],
    };
    if (typeof window !== "undefined") {
      window.__evoLiftPerfMetrics = window.__evoLiftPerfMetrics ?? [];
      window.__evoLiftPerfMetrics.push(payload);
      const topSlowQueries = [...payload.queries]
        .sort((a, b) => b.durationMs - a.durationMs)
        .slice(0, 5)
        .map((row) => `${row.name}: ${row.durationMs}ms`)
        .join(", ");
      console.info(
        `[Perf] ${payload.page} load=${payload.loadDurationMs}ms, queries=${payload.queryCount}${topSlowQueries ? `, slowest=${topSlowQueries}` : ""}`,
      );
    }
    return payload;
  }

  return { trackQuery, flush };
}
