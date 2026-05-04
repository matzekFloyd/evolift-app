"use client";

import { ChevronDown, Search } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { ExerciseBadgeChip } from "@/app/components/exercise-badge-chip";
import {
  type ExercisePickerOption,
  filterExercisePickerOptionsByQuery,
} from "@/lib/exercise-picker-options";
import { useDebouncedValue } from "@/lib/use-debounced-value";

export type ExerciseSearchSelectProps = {
  options: ExercisePickerOption[];
  value: string;
  onChange: (exerciseId: string) => void;
  /** Outer wrapper (e.g. `mt-1 w-full`). */
  className?: string;
  disabled?: boolean;
  required?: boolean;
  /** Shown on the closed trigger when `value` is empty. */
  placeholder?: string;
  /** `compact` matches small phone controls on new session. */
  size?: "compact" | "default";
  debounceMs?: number;
};

export function ExerciseSearchSelect({
  options,
  value,
  onChange,
  className = "",
  disabled = false,
  required = false,
  placeholder = "Select exercise",
  size = "default",
  debounceMs = 280,
}: ExerciseSearchSelectProps) {
  const baseId = useId();
  const listId = `${baseId}-listbox`;
  const searchId = `${baseId}-search`;
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, debounceMs);

  const selectedOption = useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value],
  );

  const filteredOptions = useMemo(
    () => filterExercisePickerOptionsByQuery(options, debouncedSearch),
    [options, debouncedSearch],
  );

  const close = useCallback(() => {
    setOpen(false);
    setSearchQuery("");
  }, []);

  const pick = useCallback(
    (exerciseId: string) => {
      onChange(exerciseId);
      close();
    },
    [close, onChange],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      const node = containerRef.current;
      if (!node || !(event.target instanceof Node) || node.contains(event.target)) {
        return;
      }
      close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  /** `h-10` / `h-9` align with common `input` + `py-2` / compact `py-1.5` row heights. */
  const triggerPad =
    size === "compact" ? "h-9 px-2 text-sm" : "h-10 px-3 text-sm";
  const searchPad = size === "compact" ? "px-2 py-1.5 text-sm" : "px-2 py-2 text-sm";
  const optionPad = size === "compact" ? "px-2 py-2.5 text-sm" : "px-3 py-2.5 text-sm";

  return (
    <div ref={containerRef} className={`relative ${className}`.trim()}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        data-required={required ? true : undefined}
        className={`flex w-full items-center justify-between gap-2 rounded-md border border-zinc-300 bg-white text-left text-zinc-900 shadow-[0_1px_0_rgba(0,0,0,0.02)] outline-none ring-sky-500/40 hover:border-zinc-400 focus-visible:border-sky-500 focus-visible:ring-2 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:opacity-60 ${triggerPad}`}
        onClick={() => {
          if (disabled) {
            return;
          }
          if (open) {
            close();
          } else {
            setSearchQuery("");
            setOpen(true);
          }
        }}
      >
        {selectedOption ? (
          <>
            <ExerciseBadgeChip slug={selectedOption.slug} />
            <span className="min-w-0 flex-1 truncate font-normal text-zinc-900">{selectedOption.label}</span>
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate text-zinc-500">{placeholder}</span>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-[60] mt-1 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg"
        >
          <div className={`flex items-center gap-2 border-b border-zinc-200 bg-zinc-50/90 ${searchPad}`}>
            <Search className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
            <input
              ref={searchInputRef}
              id={searchId}
              type="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
              placeholder="Search by name"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-zinc-900 outline-none placeholder:text-zinc-400"
              aria-label="Filter exercises by name"
            />
          </div>
          <ul
            className="max-h-[min(16rem,50vh)] overflow-y-auto overscroll-y-contain py-1"
            aria-label="Exercise choices"
          >
            {options.length === 0 ? (
              <li className="px-3 py-4 text-sm text-zinc-600">No exercises available.</li>
            ) : filteredOptions.length === 0 ? (
              <li className="px-3 py-4 text-sm text-zinc-600">No exercises match that search.</li>
            ) : (
              filteredOptions.map((option) => {
                const selected = option.id === value;
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`flex w-full items-center gap-2 text-left text-zinc-900 outline-none hover:bg-zinc-100 focus-visible:bg-zinc-100 ${optionPad} ${
                        selected ? "bg-sky-50/80 font-medium text-sky-950" : ""
                      }`}
                      onClick={() => pick(option.id)}
                    >
                      <ExerciseBadgeChip slug={option.slug} />
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
