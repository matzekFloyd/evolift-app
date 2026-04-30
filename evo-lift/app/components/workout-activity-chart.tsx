"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useRef, useState } from "react";

type WorkoutActivityPoint = {
  date: string;
  workouts: number;
  sets: number;
};

type WorkoutActivityHeatmapProps = {
  data: WorkoutActivityPoint[];
  isCompactView?: boolean;
};

function getIntensityClass(sets: number, workouts: number): string {
  if (sets <= 0) {
    return workouts > 0 ? "bg-zinc-400" : "bg-zinc-100";
  }
  if (sets <= 17) return "bg-sky-200";
  if (sets <= 24) return "bg-sky-300";
  if (sets <= 35) return "bg-sky-400";
  return "bg-sky-500";
}

function toDate(value: string): Date {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  return new Date(year, month - 1, day);
}

function startOfWeekMonday(value: Date): Date {
  const date = new Date(value);
  const dayOfWeek = date.getDay();
  const offsetToMonday = (dayOfWeek + 6) % 7;
  date.setDate(date.getDate() - offsetToMonday);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toYyyyMmDd(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function WorkoutActivityChart({ data, isCompactView = false }: WorkoutActivityHeatmapProps) {
  const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const totalWorkouts = sortedData.reduce((sum, item) => sum + item.workouts, 0);
  const totalSets = sortedData.reduce((sum, item) => sum + item.sets, 0);
  const [selectedCompactWeekStart, setSelectedCompactWeekStart] = useState<string | null>(null);
  const compactChartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isCompactView || !selectedCompactWeekStart) {
      return;
    }
    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (!compactChartRef.current?.contains(target)) {
        setSelectedCompactWeekStart(null);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isCompactView, selectedCompactWeekStart]);

  if (sortedData.length === 0) {
    return <p className="text-xs text-zinc-500">No workouts in the selected timeframe.</p>;
  }

  if (isCompactView) {
    const countsByWeek = new Map<string, number>();
    for (const item of sortedData) {
      const weekStart = toYyyyMmDd(startOfWeekMonday(toDate(item.date)));
      countsByWeek.set(weekStart, (countsByWeek.get(weekStart) ?? 0) + item.sets);
    }
    const compactData = [...countsByWeek.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-10)
      .map(([weekStart, sets]) => {
        const start = toDate(weekStart);
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
        return {
          weekStart,
          sets,
          weekLabel: `${startText}-${endText}`,
        };
      });
    const selectedWeek = compactData.find((item) => item.weekStart === selectedCompactWeekStart);

    return (
      <div>
        <div className="mb-2 text-xs text-zinc-600">
          {totalSets} sets across {totalWorkouts} workouts in last 10 weeks
        </div>
        <div
          ref={compactChartRef}
          className="compact-activity-chart relative h-36 w-full"
          style={{ WebkitTapHighlightColor: "transparent" }}
          onClick={(event) => {
            const target = event.target as HTMLElement;
            const clickedBar = target.closest(".recharts-bar-rectangle, .recharts-rectangle");
            if (!clickedBar) {
              setSelectedCompactWeekStart(null);
            }
          }}
        >
          {selectedWeek ? (
            <div className="pointer-events-none absolute right-2 top-2 z-10 rounded-md border border-zinc-300 bg-white/95 px-2 py-1 text-[11px] text-zinc-700 shadow-sm">
              {selectedWeek.weekLabel}: {selectedWeek.sets} set{selectedWeek.sets === 1 ? "" : "s"}
            </div>
          ) : null}
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={compactData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="weekLabel" tick={{ fill: "#52525b", fontSize: 10 }} minTickGap={10} />
              <YAxis allowDecimals={false} tick={{ fill: "#52525b", fontSize: 10 }} />
              <Bar
                dataKey="sets"
                fill="#0284c7"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
                onClick={(entry: { weekStart?: string; payload?: { weekStart?: string } }) => {
                  const weekStart = entry.weekStart ?? entry.payload?.weekStart;
                  if (weekStart) {
                    setSelectedCompactWeekStart(weekStart);
                  }
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  const setsByDate = new Map(sortedData.map((item) => [item.date, item.sets]));
  const workoutsByDate = new Map(sortedData.map((item) => [item.date, item.workouts]));
  const firstDate = toDate(sortedData[0].date);
  const lastDate = toDate(sortedData[sortedData.length - 1].date);
  const firstWeekStart = startOfWeekMonday(firstDate);
  const lastWeekStart = startOfWeekMonday(lastDate);

  const weeks: Array<Array<{ date: string; sets: number; workouts: number; isInRange: boolean }>> = [];
  const cursor = new Date(firstWeekStart);
  while (cursor <= lastWeekStart) {
    const week: Array<{ date: string; sets: number; workouts: number; isInRange: boolean }> = [];
    for (let i = 0; i < 7; i += 1) {
      const day = new Date(cursor);
      day.setDate(cursor.getDate() + i);
      const dateKey = toYyyyMmDd(day);
      const isInRange = day >= firstDate && day <= lastDate;
      week.push({
        date: dateKey,
        sets: isInRange ? (setsByDate.get(dateKey) ?? 0) : 0,
        workouts: isInRange ? (workoutsByDate.get(dateKey) ?? 0) : 0,
        isInRange,
      });
    }
    weeks.push(week);
    cursor.setDate(cursor.getDate() + 7);
  }

  const fixedVisibleWeeks = 26;
  const slicedWeeks = weeks.length > fixedVisibleWeeks ? weeks.slice(weeks.length - fixedVisibleWeeks) : weeks;
  const paddingWeeksNeeded = Math.max(0, fixedVisibleWeeks - slicedWeeks.length);
  const paddedWeeks = [...slicedWeeks];
  if (paddingWeeksNeeded > 0 && slicedWeeks.length > 0) {
    const firstVisibleWeekStart = toDate(slicedWeeks[0][0].date);
    for (let i = paddingWeeksNeeded; i >= 1; i -= 1) {
      const weekStart = new Date(firstVisibleWeekStart);
      weekStart.setDate(weekStart.getDate() - i * 7);
      const fillerWeek: Array<{ date: string; sets: number; workouts: number; isInRange: boolean }> = [];
      for (let day = 0; day < 7; day += 1) {
        const current = new Date(weekStart);
        current.setDate(weekStart.getDate() + day);
        fillerWeek.push({
          date: toYyyyMmDd(current),
          sets: 0,
          workouts: 0,
          isInRange: false,
        });
      }
      paddedWeeks.unshift(fillerWeek);
    }
  }
  const visibleWeeks = paddedWeeks;
  const weekdayLabels = ["Mon", "", "Wed", "", "Fri", "", "Sun"];
  const monthLabels = visibleWeeks.map((week, index) => {
    const date = toDate(week[0].date);
    const label = new Intl.DateTimeFormat(undefined, { month: "short" }).format(date);
    const previous = index > 0 ? new Intl.DateTimeFormat(undefined, { month: "short" }).format(toDate(visibleWeeks[index - 1][0].date)) : null;
    return previous !== label ? label : "";
  });
  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-xs text-zinc-600">
        <p>{totalSets} sets across {totalWorkouts} workouts in range</p>
        <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-[10px] text-zinc-500 sm:grid-cols-6">
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm border border-zinc-200 bg-zinc-100" />
            none
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-zinc-400" />
            no sets
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-sky-200" />
            1-17
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-sky-300" />
            18-24
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-sky-400" />
            25-34
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-sky-500" />
            35+
          </span>
        </div>
      </div>
      <div className="grid grid-cols-[32px_minmax(0,1fr)] gap-2">
        <div />
        <div
          className="grid gap-1.5 px-[1px] text-[10px] text-zinc-500"
          style={{ gridTemplateColumns: `repeat(${visibleWeeks.length}, minmax(0, 1fr))` }}
        >
          {monthLabels.map((label, index) => (
            <div key={`month-${index}`} className="truncate">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-rows-7 gap-1.5 text-[10px] leading-3 text-zinc-500">
          {weekdayLabels.map((label, index) => (
            <div key={`weekday-${index}`} className="flex items-center">
              {label}
            </div>
          ))}
        </div>
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${visibleWeeks.length}, minmax(0, 1fr))` }}
        >
          {visibleWeeks.map((week, weekIndex) => (
            <div key={`week-${weekIndex}`} className="grid grid-rows-7 gap-1.5">
              {week.map((day) => {
                const parsedDate = toDate(day.date);
                const tooltip = `${new Intl.DateTimeFormat(undefined, {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                }).format(parsedDate)}: ${day.sets} set${day.sets === 1 ? "" : "s"} across ${
                  day.workouts
                } workout${day.workouts === 1 ? "" : "s"}`;
                return (
                  <div
                    key={day.date}
                    title={tooltip}
                    aria-label={tooltip}
                    className={`cursor-pointer rounded-sm border border-zinc-200 transition hover:brightness-95 active:scale-95 ${
                      day.isInRange ? getIntensityClass(day.sets, day.workouts) : "bg-zinc-100"
                    }`}
                    style={{ width: "100%", aspectRatio: "1 / 1", height: "auto" }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
