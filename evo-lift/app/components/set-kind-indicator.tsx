import { Dumbbell, Flame } from "lucide-react";

type SetKindIndicatorProps = {
  isWarmup: boolean;
  /** `compact`: smaller padding and type; same labels as default. */
  density?: "compact" | "default";
  className?: string;
};

/**
 * Warmup vs working set label with icon + text (not color alone). Reuse for session logging and history.
 */
export function SetKindIndicator({
  isWarmup,
  density = "default",
  className = "",
}: SetKindIndicatorProps) {
  const compact = density === "compact";
  const box = compact
    ? "inline-flex max-w-full items-center gap-0.5 rounded border px-1 py-px text-[10px] font-semibold leading-none"
    : "inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium";

  if (isWarmup) {
    return (
      <span
        className={`${box} border-zinc-200 bg-zinc-100 text-zinc-800 ${className}`}
        title="Warmup set"
      >
        <Flame
          className={`shrink-0 text-zinc-600 ${compact ? "h-3 w-3" : "h-3.5 w-3.5"}`}
          aria-hidden
        />
        <span>Warmup</span>
      </span>
    );
  }

  return (
    <span
      className={`${box} border-zinc-200 bg-white text-zinc-800 ${className}`}
      title="Working set"
    >
      <Dumbbell
        className={`shrink-0 text-sky-800 ${compact ? "h-3 w-3" : "h-3.5 w-3.5"}`}
        aria-hidden
      />
      <span>Working</span>
    </span>
  );
}
