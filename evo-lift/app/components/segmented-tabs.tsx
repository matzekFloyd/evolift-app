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
  buttonMinWidthClassName?: string;
};

export function SegmentedTabs<T extends string>({
  value,
  onChange,
  options,
  className,
  buttonMinWidthClassName = "sm:min-w-36",
}: SegmentedTabsProps<T>) {
  return (
    <div
      className={`rounded-lg border border-zinc-300 bg-zinc-50 p-1 ${className ?? ""}`.trim()}
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
              className={`inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors sm:w-auto ${buttonMinWidthClassName} ${
                isActive
                  ? "bg-sky-100 text-sky-900"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
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
