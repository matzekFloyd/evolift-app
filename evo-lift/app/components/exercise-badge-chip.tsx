import { toExerciseBadge } from "@/lib/exercise-badge";

type ExerciseBadgeChipProps = {
  slug: string;
  /** Extra classes (merged after variant). */
  className?: string;
  /** `sessionLogged` matches session list badges when the user logged that exercise. */
  variant?: "default" | "sessionLogged";
  title?: string;
  "aria-label"?: string;
};

const variantClass: Record<NonNullable<ExerciseBadgeChipProps["variant"]>, string> = {
  default: "border-zinc-300 bg-zinc-50 text-zinc-700",
  sessionLogged: "border-sky-300 bg-sky-100 text-sky-900",
};

/** Fixed-width badge so labels line up in lists and selects. */
export function ExerciseBadgeChip({
  slug,
  className = "",
  variant = "default",
  title,
  "aria-label": ariaLabel,
}: ExerciseBadgeChipProps) {
  return (
    <span
      title={title}
      aria-label={ariaLabel}
      className={[
        "inline-flex h-6 w-11 shrink-0 items-center justify-center rounded border px-0.5 text-[10px] font-semibold tracking-wide",
        variantClass[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {toExerciseBadge(slug)}
    </span>
  );
}
