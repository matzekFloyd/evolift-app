"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";

type InfoPopoverProps = {
  /** Accessible name for the popover (panel `aria-label`). */
  label: string;
  children: ReactNode;
  className?: string;
};

export function InfoPopover({ label, children, className }: InfoPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target || !rootRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative inline-flex shrink-0 ${className ?? ""}`.trim()}>
      <button
        type="button"
        className={[
          "inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 outline-none transition-colors",
          "hover:bg-zinc-300/35 hover:text-zinc-900",
          "focus-visible:ring-2 focus-visible:ring-sky-500/45 focus-visible:ring-offset-0",
          open ? "bg-zinc-300/30 text-sky-800" : "bg-transparent",
        ].join(" ")}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        aria-label={label}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Info className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={label}
          className="absolute right-0 top-full z-30 mt-1.5 w-[min(22rem,calc(100vw-2rem))] rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs leading-snug text-zinc-700 shadow-md"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
