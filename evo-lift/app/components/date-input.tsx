"use client";

import type { ComponentProps } from "react";

export type DateInputProps = Omit<ComponentProps<"input">, "type">;

/**
 * Native date field: full control opens the browser date picker (not only the calendar icon)
 * where supported, with a pointer cursor on the clickable region.
 */
export function DateInput({
  className = "",
  onClick,
  disabled,
  readOnly,
  ...props
}: DateInputProps) {
  const cursorClass = disabled
    ? "cursor-not-allowed"
    : readOnly
      ? "cursor-default"
      : "cursor-pointer";

  return (
    <input
      {...props}
      type="date"
      disabled={disabled}
      readOnly={readOnly}
      className={`${className} ${cursorClass}`.trim()}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || disabled || readOnly) {
          return;
        }
        const input = event.currentTarget;
        try {
          input.showPicker?.();
        } catch {
          /* Unsupported, blocked, or already open */
        }
      }}
    />
  );
}
