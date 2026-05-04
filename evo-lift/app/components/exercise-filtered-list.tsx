"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  type ExercisePickerOption,
  filterExercisePickerOptionsByQuery,
} from "@/lib/exercise-picker-options";
import { useDebouncedValue } from "@/lib/use-debounced-value";

export type ExerciseFilteredListItem = ExercisePickerOption;

type ExerciseFilteredListProps<T extends ExerciseFilteredListItem> = {
  items: T[];
  renderItem: (item: T) => ReactNode;
  filterLabel?: string;
  searchPlaceholder?: string;
  debounceMs?: number;
  /** When `items` is non-empty but the debounced filter matches none. */
  emptyFilterMessage?: string;
  listClassName?: string;
  /** Controlled search text (e.g. URL-synced). Omit for internal-only state. */
  searchText?: string;
  onSearchTextChange?: (value: string) => void;
};

export function ExerciseFilteredList<T extends ExerciseFilteredListItem>({
  items,
  renderItem,
  filterLabel = "Search",
  searchPlaceholder = "Search by name or badge",
  debounceMs = 280,
  emptyFilterMessage = "No exercises match that search.",
  listClassName = "mt-3 max-h-64 space-y-2 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50/80 p-3",
  searchText: controlledSearch,
  onSearchTextChange,
}: ExerciseFilteredListProps<T>) {
  const [internalSearch, setInternalSearch] = useState("");
  const isControlled = controlledSearch !== undefined && onSearchTextChange !== undefined;
  const searchText = isControlled ? controlledSearch : internalSearch;
  const setSearchText = isControlled ? onSearchTextChange! : setInternalSearch;

  const debouncedSearch = useDebouncedValue(searchText, debounceMs);
  const filteredItems = useMemo(
    () => filterExercisePickerOptionsByQuery(items as ExercisePickerOption[], debouncedSearch),
    [items, debouncedSearch],
  );

  return (
    <>
      <label className="mt-3 block text-sm font-medium">
        {filterLabel}
        <input
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
          placeholder={searchPlaceholder}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <ul className={listClassName}>
        {filteredItems.length === 0 && items.length > 0 ? (
          <li className="px-1 py-2 text-sm text-zinc-600 sm:col-span-2">{emptyFilterMessage}</li>
        ) : (
          filteredItems.map((item) => (
            <li key={item.id} className="min-w-0">
              {renderItem(item as T)}
            </li>
          ))
        )}
      </ul>
    </>
  );
}
