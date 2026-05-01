import type { ReactNode } from "react";

export type SegmentedTabOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
};

type SegmentedTabsProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedTabOption<T>[];
  className?: string;
};

export function SegmentedTabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: SegmentedTabsProps<T>) {
  return (
    <div
      className={`rounded-md border border-zinc-300 bg-zinc-100 p-1 ${className ?? ""}`.trim()}
      role="tablist"
      aria-label="Sections"
    >
      <div className="grid gap-1 sm:inline-flex">
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(option.value)}
              className={`inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors sm:w-auto sm:min-w-36 ${
                isActive
                  ? "border-zinc-300 bg-white text-zinc-900 shadow-[0_2px_6px_rgba(0,0,0,0.12)]"
                  : "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-white/80 hover:text-zinc-900"
              }`}
            >
              {option.icon}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
