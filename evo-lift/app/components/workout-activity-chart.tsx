"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
  if (sets <= 6) return "bg-sky-200";
  if (sets <= 10) return "bg-sky-300";
  if (sets <= 20) return "bg-sky-400";
  return "bg-sky-500";
}

function toDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
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
      .map(([weekStart, sets]) => ({ weekStart, sets }));

    return (
      <div>
        <div className="mb-2 text-xs text-zinc-600">
          {totalSets} sets across {totalWorkouts} workouts in range
        </div>
        <div className="h-36 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={compactData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis
                dataKey="weekStart"
                tickFormatter={(value: string) =>
                  new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
                    toDate(value),
                  )
                }
                tick={{ fill: "#52525b", fontSize: 10 }}
                minTickGap={10}
              />
              <YAxis allowDecimals={false} tick={{ fill: "#52525b", fontSize: 10 }} />
              <Tooltip
                formatter={(value: number) => [value, "Sets"]}
                labelFormatter={(label: string) =>
                  `Week of ${new Intl.DateTimeFormat(undefined, {
                    month: "short",
                    day: "numeric",
                  }).format(toDate(label))}`
                }
              />
              <Bar dataKey="sets" fill="#0284c7" radius={[3, 3, 0, 0]} />
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
            1-6
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-sky-300" />
            7-10
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-sky-400" />
            11-20
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-sky-500" />
            20+
          </span>
        </div>
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
              }).format(parsedDate)}: ${day.sets} set${day.sets === 1 ? "" : "s"} across ${day.workouts} workout${
                day.workouts === 1 ? "" : "s"
              }`;
              return (
                <div
                  key={day.date}
                  title={tooltip}
                  aria-label={tooltip}
                  className={`rounded-sm border border-zinc-200 ${
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
  );
}
