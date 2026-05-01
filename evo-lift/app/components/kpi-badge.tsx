import type { ReactNode } from "react";

type KpiBadgeProps = {
  label: string;
  value: string;
  icon?: ReactNode;
  description?: string;
  tone?: "sky" | "neutral" | "success";
  className?: string;
};

export function KpiBadge({
  label,
  value,
  icon,
  description,
  tone = "sky",
  className,
}: KpiBadgeProps) {
  const shellClasses =
    tone === "neutral"
      ? "border-zinc-300 bg-white"
      : tone === "success"
        ? "border-emerald-300 bg-emerald-50"
      : "border-sky-300 bg-sky-50";
  const labelClasses =
    tone === "neutral"
      ? "text-zinc-700"
      : tone === "success"
        ? "text-emerald-800"
      : "text-sky-800";
  const valueClasses =
    tone === "neutral"
      ? "text-zinc-900"
      : tone === "success"
        ? "text-emerald-900"
      : "text-sky-900";

  return (
    <div
      className={`rounded-md border px-3 py-2 text-center shadow-sm transition hover:shadow-md ${shellClasses} ${
        description ? "cursor-help" : ""
      }${
        className ? ` ${className}` : ""
      }`}
      title={description}
      aria-label={description ?? `${label}: ${value}`}
    >
      <p className={`inline-flex items-center justify-center gap-1 text-[11px] font-medium uppercase tracking-wide ${labelClasses}`}>
        {icon}
        {label}
      </p>
      <p className={`mt-0.5 text-base font-semibold leading-none sm:text-lg ${valueClasses}`}>{value}</p>
    </div>
  );
}
