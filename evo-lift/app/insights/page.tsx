"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Dumbbell, FilterX, Hash, Weight } from "lucide-react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/app/components/action-button";
import { KpiBadge } from "@/app/components/kpi-badge";
import { PageShell } from "@/app/components/page-shell";
import { StatusNotice } from "@/app/components/status-notice";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import {
  applyInsightsRange,
  loadUserWorkoutActivityBase,
  type InsightsRange,
  type WorkoutActivityPoint,
} from "@/lib/insights-data";

type RangeOption = {
  value: InsightsRange;
  label: string;
};

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
  const [basePoints, setBasePoints] = useState<WorkoutActivityPoint[]>([]);

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
        const points = await loadUserWorkoutActivityBase(supabaseBrowserClient, session.user.id);
        if (!isMounted) {
          return;
        }
        setBasePoints(points);
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <label className="block text-xs font-medium text-zinc-600">
              From
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                max={todayYyyyMmDd}
                className="mt-1 w-full rounded-md border bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-600">
              To
              <input
                type="date"
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
            className="mt-2 self-end text-sm font-normal text-amber-800 hover:text-amber-900 sm:mt-0"
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
                label="Loaded (kg)"
                value={summary.loadedKg.toFixed(1)}
                icon={<Weight className="h-4 w-4 text-zinc-600" />}
                description="Total loaded kilograms across logged sets in the selected filter window."
                tone="neutral"
              />
            </div>
            <div className="rounded-md border border-zinc-200 bg-white p-4">
              <h2 className="text-sm font-medium text-zinc-800">Volume trend</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Placeholder chart block. Connect upcoming chart components to `rangedPoints`.
              </p>
              <div className="mt-3 h-52 rounded-md border border-dashed border-zinc-300 bg-zinc-50" />
            </div>
          </div>
        )}
      </section>
    </PageShell>
  );
}
