"use client";

import type { ReactNode } from "react";

type CompactStickyBarProps = {
  actions: ReactNode;
  progressLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  isPreviousDisabled: boolean;
  isNextDisabled: boolean;
};

export function CompactStickyBar({
  actions,
  progressLabel,
  onPrevious,
  onNext,
  isPreviousDisabled,
  isNextDisabled,
}: CompactStickyBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 p-3 shadow-[0_-6px_16px_rgba(0,0,0,0.08)] backdrop-blur md:hidden">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2">
        <div className="flex items-center gap-2">{actions}</div>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onPrevious}
            disabled={isPreviousDisabled}
            className="inline-flex h-11 min-w-[96px] items-center justify-center rounded-md border border-zinc-300 bg-zinc-50 px-3 text-sm font-medium text-zinc-800 hover:border-sky-300 hover:bg-zinc-100 disabled:opacity-60"
          >
            Previous
          </button>
          <span className="text-xs text-zinc-600">{progressLabel}</span>
          <button
            type="button"
            onClick={onNext}
            disabled={isNextDisabled}
            className="inline-flex h-11 min-w-[96px] items-center justify-center rounded-md border border-sky-700 bg-sky-700 px-3 text-sm font-medium text-white hover:border-sky-600 hover:bg-sky-600 disabled:opacity-60"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
