"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ActionButtonVariant = "primary" | "secondary" | "danger";
type ActionButtonSize = "sm" | "md";
type ActionButtonIconColor = "auto" | "sky" | "zinc" | "amber" | "red" | "white";

type ActionButtonProps = {
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  fullWidth?: boolean;
  iconColor?: ActionButtonIconColor;
  className?: string;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const variantClassByType: Record<ActionButtonVariant, string> = {
  primary:
    "border-sky-700 bg-sky-700 text-white hover:border-sky-600 hover:bg-sky-600 disabled:opacity-60",
  secondary:
    "border-zinc-300 bg-zinc-50 text-zinc-800 hover:border-sky-300 hover:bg-zinc-100 disabled:opacity-60",
  danger:
    "border-red-300 bg-red-50 text-red-700 hover:border-red-400 hover:bg-red-100 disabled:opacity-60",
};

const sizeClassByType: Record<ActionButtonSize, string> = {
  sm: "h-9 px-3 text-xs",
  md: "h-10 px-3 py-2 text-sm",
};

const iconClassByType: Record<Exclude<ActionButtonIconColor, "auto">, string> = {
  sky: "[&_svg]:text-sky-700",
  zinc: "[&_svg]:text-zinc-500",
  amber: "[&_svg]:text-amber-600",
  red: "[&_svg]:text-red-600",
  white: "[&_svg]:text-white",
};

const autoIconColorByVariant: Record<ActionButtonVariant, Exclude<ActionButtonIconColor, "auto">> = {
  primary: "white",
  secondary: "sky",
  danger: "red",
};

export function ActionButton({
  variant = "secondary",
  size = "md",
  fullWidth = false,
  iconColor = "auto",
  className = "",
  type = "button",
  children,
  ...rest
}: ActionButtonProps) {
  const resolvedIconColor = iconColor === "auto" ? autoIconColorByVariant[variant] : iconColor;
  const widthClass = fullWidth ? "w-full" : "w-fit";

  return (
    <button
      type={type}
      className={[
        "inline-flex items-center justify-center gap-1 rounded-md border font-medium",
        variantClassByType[variant],
        sizeClassByType[size],
        widthClass,
        iconClassByType[resolvedIconColor],
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
