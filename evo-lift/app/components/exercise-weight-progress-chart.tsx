"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { SegmentedTabs } from "@/app/components/segmented-tabs";
import { formatDateOnlyForLocale } from "@/lib/date-format";
import type { ExerciseSessionWeightChartPoint } from "@/lib/exercise-session-weight-chart";

export type ExerciseWeightProgressSeriesMode = "total" | "loaded" | "both";

type ExerciseWeightProgressChartProps = {
  points: ExerciseSessionWeightChartPoint[];
  /** Shown on the same row as the Total / Loaded / Both control (left side). */
  seriesHint?: ReactNode;
};

const LINE_TOTAL = "Total (kg)";
const LINE_LOADED = "Loaded (kg)";

function formatKgTick(value: number): string {
  if (!Number.isFinite(value)) {
    return "";
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

export function ExerciseWeightProgressChart({ points, seriesHint }: ExerciseWeightProgressChartProps) {
  const [seriesMode, setSeriesMode] = useState<ExerciseWeightProgressSeriesMode>("total");
  const [isCompactView, setIsCompactView] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsCompactView(mediaQuery.matches);
    apply();
    mediaQuery.addEventListener("change", apply);
    return () => mediaQuery.removeEventListener("change", apply);
  }, []);

  const chartData = useMemo(
    () =>
      points.map((p) => ({
        ...p,
        totalValue: p.heaviestTotalKg,
        loadedValue: p.heaviestLoadedKg,
      })),
    [points],
  );

  const showTotal = seriesMode === "total" || seriesMode === "both";
  const showLoaded = seriesMode === "loaded" || seriesMode === "both";

  const renderTooltip = ({
    active,
    payload,
  }: TooltipContentProps<ValueType, NameType>) => {
    if (!active || !payload?.length) {
      return null;
    }
    const source = payload[0]?.payload as ExerciseSessionWeightChartPoint | undefined;
    if (!source) {
      return null;
    }
    const sessionDate = formatDateOnlyForLocale(source.performedOn);
    return (
      <div className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm shadow-sm">
        <p className="font-medium text-zinc-800">Session · {sessionDate}</p>
        <p className="text-zinc-700">
          {LINE_TOTAL}: {source.heaviestTotalKg.toFixed(1)} kg
        </p>
        <p className="text-zinc-700">
          {LINE_LOADED}: {source.heaviestLoadedKg.toFixed(1)} kg
        </p>
        <p className="text-zinc-600">
          Base: {source.baseKg.toFixed(1)} kg (total minus loaded for that set)
        </p>
        <p className="text-zinc-500">Heaviest working set: #{source.heaviestSetNumber}</p>
      </div>
    );
  };

  if (points.length === 0) {
    return (
      <p className="text-sm text-zinc-600">
        No working sets with logged weight yet, so there is nothing to plot.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className={[
          "flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-2",
          seriesHint ? "" : "justify-end",
        ].join(" ")}
      >
        {seriesHint ? (
          <p className="min-w-0 flex-1 text-xs leading-snug text-zinc-600">{seriesHint}</p>
        ) : null}
        <SegmentedTabs<ExerciseWeightProgressSeriesMode>
          value={seriesMode}
          onChange={setSeriesMode}
          className={seriesHint ? "w-auto min-w-[10.5rem] shrink-0" : "w-full sm:w-auto sm:min-w-[13.5rem]"}
          buttonLayout="equal-row"
          buttonMinWidthClassName="min-w-0"
          options={[
            { value: "total", label: "Total" },
            { value: "loaded", label: "Loaded" },
            { value: "both", label: "Both" },
          ]}
        />
      </div>

      {points.length === 1 ? (
        <p className="text-xs text-zinc-600">
          One session with logged working weights — add more sessions to see a trend line.
        </p>
      ) : null}

      <div
        className="exercise-weight-progress-chart relative h-52 w-full sm:h-64"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis
              dataKey="xTickLabel"
              tick={{ fill: "#52525b", fontSize: 11 }}
              interval={isCompactView ? "preserveStartEnd" : 0}
              minTickGap={isCompactView ? 28 : 12}
            />
            <YAxis
              tick={{ fill: "#52525b", fontSize: 11 }}
              tickFormatter={(v: number) => `${formatKgTick(v)} kg`}
              width={isCompactView ? 52 : 60}
            />
            <Tooltip content={renderTooltip} />
            {seriesMode === "both" ? (
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value) => <span className="text-zinc-700">{String(value)}</span>}
              />
            ) : null}
            {showTotal ? (
              <Line
                type="monotone"
                dataKey="totalValue"
                name={LINE_TOTAL}
                stroke="#0284c7"
                strokeWidth={2}
                dot={{ r: points.length <= 8 ? 3 : 2 }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            ) : null}
            {showLoaded ? (
              <Line
                type="monotone"
                dataKey="loadedValue"
                name={LINE_LOADED}
                stroke="#0f766e"
                strokeWidth={2}
                dot={{ r: points.length <= 8 ? 3 : 2 }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
