"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  Cell,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";

type WeeklyVolumeChartPoint = {
  weekStart: string;
  volumeKg: number;
  workingSets: number;
  sessionCount: number;
  movingAverage: number | null;
};

type InsightsWeeklyVolumeChartProps = {
  data: WeeklyVolumeChartPoint[];
  metric: "volume" | "workingSets";
};

function formatWeekLabel(dateText: string): string {
  const date = new Date(`${dateText}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function toDate(value: string): Date {
  const [yearText, monthText, dayText] = value.split("-");
  return new Date(Number(yearText), Number(monthText) - 1, Number(dayText));
}

function formatCompactNumber(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return `${Math.round(value)}`;
}

export function InsightsWeeklyVolumeChart({ data, metric }: InsightsWeeklyVolumeChartProps) {
  const isVolumeMetric = metric === "volume";
  const valueKey = isVolumeMetric ? "volumeKg" : "workingSets";
  const barName = isVolumeMetric ? "Volume" : "Working sets";
  const movingAverageName = isVolumeMetric ? "4w avg" : "4w avg working sets";
  const [isCompactView, setIsCompactView] = useState(false);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const applyMatch = () => setIsCompactView(mediaQuery.matches);
    applyMatch();
    mediaQuery.addEventListener("change", applyMatch);
    return () => {
      mediaQuery.removeEventListener("change", applyMatch);
    };
  }, []);

  useEffect(() => {
    if (!isCompactView || !selectedWeekStart) {
      return;
    }
    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (!chartRef.current?.contains(target)) {
        setSelectedWeekStart(null);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isCompactView, selectedWeekStart]);

  const selectedWeek = useMemo(
    () => data.find((item) => item.weekStart === selectedWeekStart) ?? null,
    [data, selectedWeekStart],
  );
  const selectedWeekRangeLabel = useMemo(() => {
    if (!selectedWeek) {
      return "";
    }
    const start = toDate(selectedWeek.weekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const startText = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(start);
    const endText = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(end);
    return `${startText}-${endText}`;
  }, [selectedWeek]);

  const renderTooltip = ({
    active,
    payload,
    label,
  }: TooltipContentProps<ValueType, NameType>) => {
    if (!active || !payload || payload.length === 0 || typeof label !== "string") {
      return null;
    }
    const source = payload[0]?.payload as WeeklyVolumeChartPoint | undefined;
    const sessionCount = source?.sessionCount ?? 0;
    return (
      <div className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm shadow-sm">
        <p className="font-medium text-zinc-800">{`Week of ${formatWeekLabel(label)}`}</p>
        {payload.map((entry) => {
          const numericValue = Number(entry.value ?? 0);
          const formatted = (() => {
            if (entry.name === barName) {
              if (isVolumeMetric) {
                return `${numericValue.toFixed(1)} kg`;
              }
              return `${Math.round(numericValue)}`;
            }
            if (entry.name === movingAverageName) {
              return isVolumeMetric
                ? `${numericValue.toFixed(1)} kg`
                : `${numericValue.toFixed(1)}`;
            }
            return `${numericValue}`;
          })();
          return (
            <p key={`${entry.name}`} className="text-zinc-700">
              {entry.name}: {formatted}
            </p>
          );
        })}
        <p className="text-zinc-700">Sessions: {sessionCount}</p>
      </div>
    );
  };

  return (
    <div
      ref={chartRef}
      className="insights-weekly-chart relative h-56 w-full sm:h-72"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis
            dataKey="weekStart"
            tick={{ fill: "#52525b", fontSize: 11 }}
            tickFormatter={formatWeekLabel}
            minTickGap={isCompactView ? 32 : 20}
            interval={isCompactView ? "preserveStartEnd" : 0}
          />
          <YAxis
            tick={{ fill: "#52525b", fontSize: 11 }}
            tickFormatter={(value: number) =>
              isVolumeMetric
                ? isCompactView
                  ? `${formatCompactNumber(value)} kg`
                  : `${Math.round(value)} kg`
                : `${Math.round(value)}`
            }
            width={isCompactView ? 56 : 72}
          />
          <Tooltip
            content={renderTooltip}
            cursor={isCompactView ? false : undefined}
            active={isCompactView ? false : undefined}
          />
          <Bar
            dataKey={valueKey}
            name={barName}
            fill="#0284c7"
            radius={[4, 4, 0, 0]}
          >
            {data.map((item) => {
              const isSelected = selectedWeekStart === item.weekStart;
              const hasSelection = selectedWeekStart !== null;
              return (
                <Cell
                  key={`bar-${item.weekStart}`}
                  fill={isSelected ? "#0369a1" : hasSelection ? "#7dd3fc" : "#0284c7"}
                  stroke={isSelected ? "#075985" : undefined}
                  strokeWidth={isSelected ? 1.5 : 0}
                  onClick={() => {
                    setSelectedWeekStart((current) =>
                      current === item.weekStart ? null : item.weekStart,
                    );
                  }}
                />
              );
            })}
          </Bar>
          <Line
            type="monotone"
            dataKey="movingAverage"
            name={movingAverageName}
            stroke="#0f766e"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      {isCompactView && selectedWeek ? (
        <div className="pointer-events-none absolute right-2 top-2 z-10 rounded-md border border-zinc-200 bg-white/95 px-2 py-1.5 text-sm shadow-sm">
          <p className="font-medium text-zinc-800">{`Week of ${formatWeekLabel(selectedWeek.weekStart)}`}</p>
          <p className="text-zinc-700">
            {barName}:{" "}
            {isVolumeMetric
              ? `${selectedWeek.volumeKg.toFixed(1)} kg`
              : `${selectedWeek.workingSets}`}
          </p>
          {selectedWeek.movingAverage != null ? (
            <p className="text-zinc-700">
              {movingAverageName}:{" "}
              {isVolumeMetric
                ? `${selectedWeek.movingAverage.toFixed(1)} kg`
                : `${selectedWeek.movingAverage.toFixed(1)}`}
            </p>
          ) : null}
          <p className="text-zinc-700">Sessions: {selectedWeek.sessionCount}</p>
          <p className="text-zinc-500">{selectedWeekRangeLabel}</p>
        </div>
      ) : null}
    </div>
  );
}
