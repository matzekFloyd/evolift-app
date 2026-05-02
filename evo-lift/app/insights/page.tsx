"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Dumbbell, FilterX, Hash, Weight } from "lucide-react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/app/components/action-button";
import { KpiBadge } from "@/app/components/kpi-badge";
import { InsightsWeeklyVolumeChart } from "@/app/components/insights-weekly-volume-chart";
import { DateInput } from "@/app/components/date-input";
import { PageShell } from "@/app/components/page-shell";
import { StatusNotice } from "@/app/components/status-notice";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import {
  applyInsightsRange,
  loadUserWorkoutActivityBase,
  loadUserWeeklyVolumeBase,
  type InsightsRange,
  type WeeklyVolumePoint,
  type WorkoutActivityPoint,
} from "@/lib/insights-data";

type RangeOption = {
  value: InsightsRange;
  label: string;
};
type InsightTrendMetric = "volume" | "workingSets";

const rangeOptions: RangeOption[] = [
  { value: "4w", label: "4w" },
  { value: "12w", label: "12w" },
  { value: "6m", label: "6m" },
  { value: "all", label: "All" },
];
const defaultInsightsRange: InsightsRange = "12w";

function toYyyyMmDd(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayYyyyMmDd(): string {
  return toYyyyMmDd(new Date());
}

function getDateRangeForPreset(range: InsightsRange): { from: string; to: string } {
  const today = new Date();
  const to = toYyyyMmDd(today);
  const fromDate = new Date(today);
  if (range === "4w") {
    fromDate.setDate(fromDate.getDate() - 27);
    return { from: toYyyyMmDd(fromDate), to };
  }
  if (range === "12w") {
    fromDate.setDate(fromDate.getDate() - 83);
    return { from: toYyyyMmDd(fromDate), to };
  }
  if (range === "6m") {
    fromDate.setMonth(fromDate.getMonth() - 6);
    return { from: toYyyyMmDd(fromDate), to };
  }
  return { from: "", to };
}

export default function InsightsPage() {
  const router = useRouter();
  const todayYyyyMmDd = getTodayYyyyMmDd();
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<InsightsRange>(defaultInsightsRange);
  const [dateFrom, setDateFrom] = useState(() => getDateRangeForPreset(defaultInsightsRange).from);
  const [dateTo, setDateTo] = useState(() => getDateRangeForPreset(defaultInsightsRange).to);
  const [trendMetric, setTrendMetric] = useState<InsightTrendMetric>("volume");
  const [basePoints, setBasePoints] = useState<WorkoutActivityPoint[]>([]);
  const [weeklyVolumeBase, setWeeklyVolumeBase] = useState<WeeklyVolumePoint[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
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

      try {
        const [points, weekly] = await Promise.all([
          loadUserWorkoutActivityBase(supabaseBrowserClient, session.user.id),
          loadUserWeeklyVolumeBase(supabaseBrowserClient, session.user.id),
        ]);
        if (!isMounted) {
          return;
        }
        setBasePoints(points);
        setWeeklyVolumeBase(weekly);
        setIsLoading(false);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : "Could not load insights.");
        setIsLoading(false);
      }
    }

    void loadData();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const rangedPoints = useMemo(
    () => applyInsightsRange(basePoints, selectedRange),
    [basePoints, selectedRange],
  );

  const filteredPoints = useMemo(
    () =>
      rangedPoints.filter((point) => {
        if (dateFrom && point.date < dateFrom) {
          return false;
        }
        if (dateTo && point.date > dateTo) {
          return false;
        }
        return true;
      }),
    [dateFrom, dateTo, rangedPoints],
  );

  const summary = useMemo(() => {
    const workouts = filteredPoints.reduce((sum, item) => sum + item.workouts, 0);
    const sets = filteredPoints.reduce((sum, item) => sum + item.sets, 0);
    const loadedKg = filteredPoints.reduce((sum, item) => sum + item.loadedKg, 0);
    return { workouts, sets, loadedKg };
  }, [filteredPoints]);

  const weeklyVolumeRanged = useMemo(() => {
    const asDailyPoints = weeklyVolumeBase.map((item) => ({
      date: item.weekStart,
      workouts: item.sessionCount,
      sets: item.workingSets,
      loadedKg: item.volumeKg,
    }));
    const ranged = applyInsightsRange(asDailyPoints, selectedRange);
    const rangedDates = new Set(ranged.map((item) => item.date));
    return weeklyVolumeBase.filter((item) => rangedDates.has(item.weekStart));
  }, [selectedRange, weeklyVolumeBase]);

  const weeklyVolumeFiltered = useMemo(
    () =>
      weeklyVolumeRanged.filter((point) => {
        if (dateFrom && point.weekStart < dateFrom) {
          return false;
        }
        if (dateTo && point.weekStart > dateTo) {
          return false;
        }
        return true;
      }),
    [dateFrom, dateTo, weeklyVolumeRanged],
  );

  const weeklyVolumeChartData = useMemo(() => {
    const movingAverageSource = (item: WeeklyVolumePoint) =>
      trendMetric === "volume" ? item.volumeKg : item.workingSets;
    return weeklyVolumeFiltered.map((item, index) => {
      if (index < 3) {
        return { ...item, movingAverage: null };
      }
      const window = weeklyVolumeFiltered.slice(index - 3, index + 1);
      const average = window.reduce((sum, row) => sum + movingAverageSource(row), 0) / window.length;
      return { ...item, movingAverage: Number(average.toFixed(2)) };
    });
  }, [trendMetric, weeklyVolumeFiltered]);

  const workingSetsTotal = useMemo(
    () => weeklyVolumeFiltered.reduce((sum, item) => sum + item.workingSets, 0),
    [weeklyVolumeFiltered],
  );

  const trendMetricKpi = useMemo(() => {
    if (trendMetric === "workingSets") {
      return {
        label: "Working sets",
        value: String(workingSetsTotal),
        icon: <Hash className="h-4 w-4 text-zinc-600" />,
        description: "Total non-warmup sets in the selected filter window.",
      };
    }
    return {
      label: "Volume (kg)",
      value: summary.loadedKg.toFixed(1),
      icon: <Weight className="h-4 w-4 text-zinc-600" />,
      description: "Total weekly training volume (reps x loaded kg) in the selected filter window.",
    };
  }, [summary.loadedKg, trendMetric, workingSetsTotal]);

  return (
    <PageShell>
      <section>
        <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <BarChart3 className="h-6 w-6 text-sky-700" />
          Insights
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Review your training trends. Visualizations will expand in follow-up tickets.
        </p>
      </section>

      <section className="panel p-5">
        <div className="flex flex-col gap-2">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <label className="block text-xs font-medium text-zinc-600">
              From
              <DateInput
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                max={todayYyyyMmDd}
                className="mt-1 w-full rounded-md border bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-600">
              To
              <DateInput
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                max={todayYyyyMmDd}
                className="mt-1 w-full rounded-md border bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <div>
              <p className="text-xs font-medium text-zinc-600">Range</p>
              <div className="mt-1 grid w-full grid-cols-4 gap-1 rounded-md border border-zinc-300 bg-zinc-50 p-1 sm:inline-flex sm:w-auto">
                {rangeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setSelectedRange(option.value);
                      const preset = getDateRangeForPreset(option.value);
                      setDateFrom(preset.from);
                      setDateTo(preset.to);
                    }}
                    className={`rounded px-3 py-1 text-xs font-medium ${
                      selectedRange === option.value
                        ? "bg-sky-100 text-sky-900"
                        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <ActionButton
            type="button"
            onClick={() => {
              setSelectedRange("all");
              setDateFrom("");
              setDateTo("");
            }}
            disabled={
              selectedRange === "all" &&
              dateFrom === "" &&
              dateTo === ""
            }
            variant="secondary"
            size="sm"
            className="mt-1 w-full text-sm font-normal text-amber-800 hover:text-amber-900 sm:mt-0 sm:w-auto sm:self-end"
            iconColor="amber"
          >
            <FilterX className="h-3.5 w-3.5" />
            Clear filters
          </ActionButton>
        </div>
      </section>

      <section className="panel p-5">
        {errorMessage ? (
          <StatusNotice message={errorMessage} tone="error" />
        ) : isLoading ? (
          <p className="text-sm text-zinc-600">Loading insights...</p>
        ) : filteredPoints.length === 0 ? (
          <p className="text-sm text-zinc-600">
            No workout data in this range yet. Log sessions to unlock insights.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <KpiBadge
                label="Workouts"
                value={String(summary.workouts)}
                icon={<Dumbbell className="h-4 w-4 text-zinc-600" />}
                description="Total workout sessions in the selected filter window."
                tone="neutral"
              />
              <KpiBadge
                label="Sets"
                value={String(summary.sets)}
                icon={<Hash className="h-4 w-4 text-zinc-600" />}
                description="Total logged sets in the selected filter window."
                tone="neutral"
              />
              <KpiBadge
                label={trendMetricKpi.label}
                value={trendMetricKpi.value}
                icon={trendMetricKpi.icon}
                description={trendMetricKpi.description}
                tone="neutral"
              />
            </div>
            <div className="rounded-md border border-zinc-200 bg-white p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <h2 className="text-sm font-medium text-zinc-800">
                  {trendMetric === "volume" ? "Volume trend" : "Working sets trend"}
                </h2>
                <div className="grid w-full grid-cols-2 rounded-md border border-zinc-300 bg-zinc-50 p-1 sm:inline-flex sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setTrendMetric("volume")}
                    className={`rounded px-2.5 py-1.5 text-xs font-medium ${
                      trendMetric === "volume"
                        ? "bg-sky-100 text-sky-900"
                        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                    }`}
                  >
                    Volume
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrendMetric("workingSets")}
                    className={`rounded px-2.5 py-1.5 text-xs font-medium ${
                      trendMetric === "workingSets"
                        ? "bg-sky-100 text-sky-900"
                        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                    }`}
                  >
                    Working sets
                  </button>
                </div>
              </div>
              {weeklyVolumeChartData.length === 0 ? (
                <p className="mt-1 text-xs text-zinc-500">
                  No qualifying {trendMetric === "volume" ? "set volume" : "working set"} data for
                  the current filters yet.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-xs text-zinc-500">
                    {trendMetric === "volume"
                      ? "Weekly total volume (reps x loaded kg) with session count in tooltip."
                      : "Weekly non-warmup set count with session count in tooltip."}
                  </p>
                  <div className="mt-3">
                    <InsightsWeeklyVolumeChart data={weeklyVolumeChartData} metric={trendMetric} />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </section>
    </PageShell>
  );
}
