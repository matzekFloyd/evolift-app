"use client";

import { useEffect, useMemo, useState } from "react";
import { ActionButton } from "@/app/components/action-button";
import { toExerciseBadge } from "@/lib/exercise-badge";
import { formatDateOnlyForLocale } from "@/lib/date-format";

type SortKey = "number" | "performed_on";
type SortDirection = "asc" | "desc";

export type SessionsTableBadge = {
  slug: string;
  hasLoggedSet: boolean;
};

export type SessionsTableRow = {
  id: string;
  number: number;
  performedOn: string;
  notes: string;
  isPlanned: boolean;
  badges: SessionsTableBadge[];
};

type SessionsTableProps = {
  rows: SessionsTableRow[];
  dateHeaderLabel: string;
  emptyMessage: string;
  openingRowId?: string | null;
  onOpenRow: (rowId: string) => void;
  pageSize?: number;
  showNotesColumn?: boolean;
  compactMode?: boolean;
};

export function SessionsTable({
  rows,
  dateHeaderLabel,
  emptyMessage,
  openingRowId = null,
  onOpenRow,
  pageSize = 20,
  showNotesColumn = true,
  compactMode = false,
}: SessionsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("performed_on");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedNotesIds, setExpandedNotesIds] = useState<Set<string>>(new Set());

  const sortedRows = useMemo(() => {
    const next = [...rows];
    next.sort((a, b) => {
      let left: number | string = "";
      let right: number | string = "";

      if (sortKey === "number") {
        left = a.number;
        right = b.number;
      } else if (sortKey === "performed_on") {
        left = a.performedOn;
        right = b.performedOn;
      }

      if (left < right) return sortDirection === "asc" ? -1 : 1;
      if (left > right) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return next;
  }, [rows, showNotesColumn, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [currentPage, pageSize, sortedRows]);

  useEffect(() => {
    setCurrentPage(1);
  }, [rows, sortDirection, sortKey]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  function handleSort(column: SortKey) {
    if (sortKey === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(column);
    setSortDirection(column === "performed_on" ? "desc" : "asc");
  }

  function renderSortIndicator(column: SortKey) {
    if (sortKey !== column) {
      return <span className="text-zinc-400">-</span>;
    }
    return <span>{sortDirection === "asc" ? "↑" : "↓"}</span>;
  }

  function toggleExpandedNotes(id: string) {
    setExpandedNotesIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table
          className={`w-full table-fixed text-left text-sm ${
            compactMode ? "min-w-0" : "min-w-full md:min-w-[620px]"
          }`}
        >
          <colgroup>
            <col className={compactMode ? "w-[52px]" : "w-[64px]"} />
            <col className={compactMode ? "w-[130px]" : "w-[180px]"} />
            <col className={showNotesColumn ? "w-[260px]" : "w-auto"} />
            {showNotesColumn ? <col className={compactMode ? "w-[140px]" : "w-[180px]"} /> : null}
          </colgroup>
          <thead>
            <tr className="border-b">
              <th className="px-2 py-2 font-medium">
                <button type="button" onClick={() => handleSort("number")} className="inline-flex items-center gap-1">
                  No. {renderSortIndicator("number")}
                </button>
              </th>
              <th className="px-2 py-2 font-medium">
                <button
                  type="button"
                  onClick={() => handleSort("performed_on")}
                  className="inline-flex items-center gap-1"
                >
                  {dateHeaderLabel} {renderSortIndicator("performed_on")}
                </button>
              </th>
              <th className="px-2 py-2 font-medium">Exercises</th>
              {showNotesColumn ? (
                <th className="px-2 py-2 font-medium">Notes</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td
                  className="break-words whitespace-normal px-2 py-4 text-zinc-600"
                  colSpan={showNotesColumn ? 4 : 3}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pagedRows.map((row) => {
                const isExpanded = expandedNotesIds.has(row.id);
                const needsTruncate = row.notes.length > 64;
                const visibleNotes =
                  needsTruncate && !isExpanded ? `${row.notes.slice(0, 64)}[...]` : row.notes || "-";
                const isOpening = openingRowId === row.id;
                return (
                  <tr
                    key={row.id}
                    className={`border-b last:border-b-0 ${
                      isOpening ? "cursor-progress bg-sky-100" : "cursor-pointer hover:bg-sky-50"
                    }`}
                    onClick={() => onOpenRow(row.id)}
                  >
                    <td className="px-2 py-2">{row.number || "-"}</td>
                    <td className="px-2 py-2">
                      <span className="inline-flex items-center gap-2">
                        {formatDateOnlyForLocale(row.performedOn)}
                        {isOpening ? <span className="text-xs font-medium text-sky-700">Opening...</span> : null}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap items-center gap-1">
                        {row.badges.slice(0, 8).map((item, index) => (
                          <span
                            key={`${row.id}-${item.slug}-${index}`}
                            className={`inline-flex h-6 min-w-8 items-center justify-center rounded border px-1 text-[10px] font-semibold tracking-wide ${
                              item.hasLoggedSet
                                ? "border-sky-300 bg-sky-100 text-sky-900"
                                : "border-zinc-300 bg-zinc-50 text-zinc-700"
                            }`}
                            title={item.slug}
                            aria-label={item.slug}
                          >
                            {toExerciseBadge(item.slug)}
                          </span>
                        ))}
                        {row.badges.length === 0 ? <span className="text-zinc-500">-</span> : null}
                      </div>
                    </td>
                    {showNotesColumn ? (
                      <td className="px-2 py-2">
                        <span>{visibleNotes}</span>
                        {needsTruncate ? (
                          <button
                            type="button"
                            className="ml-2 text-xs underline"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleExpandedNotes(row.id);
                            }}
                          >
                            {isExpanded ? "[less]" : "[...]"}
                          </button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {sortedRows.length > 0 && totalPages > 1 ? (
        <div className="flex items-center justify-between pt-1 text-sm">
          <p className="text-zinc-600">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <ActionButton
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              variant="secondary"
              size="sm"
              className="font-normal"
            >
              Previous
            </ActionButton>
            <ActionButton
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              variant="primary"
              size="sm"
              className="font-normal"
            >
              Next
            </ActionButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
