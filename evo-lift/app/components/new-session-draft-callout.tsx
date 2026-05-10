"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, FileEdit, Trash2 } from "lucide-react";
import { ActionButton } from "@/app/components/action-button";
import {
  formatRelativePastFromIso,
  getNewSessionDraftStorageKey,
  isMeaningfulNewSessionDraft,
  NEW_SESSION_DRAFT_CHANGED_EVENT,
  notifyNewSessionDraftChanged,
  parseNewSessionDraftFromStorage,
} from "@/lib/new-session-draft";
import { coalesceNewSessionDraftPerformedOn, getTodayYyyyMmDd } from "@/lib/session-date";

type DraftSummary = {
  performedOnDisplay: string;
  editedLine: string | null;
};

function readDraftSummary(userId: string): DraftSummary | null {
  const raw = window.localStorage.getItem(getNewSessionDraftStorageKey(userId));
  const draft = parseNewSessionDraftFromStorage(raw);
  if (!draft) {
    return null;
  }
  const todayYyyyMmDd = getTodayYyyyMmDd();
  if (!isMeaningfulNewSessionDraft(draft, { todayYyyyMmDd })) {
    return null;
  }
  const performedOnDisplay = coalesceNewSessionDraftPerformedOn(draft.performedOn);
  let editedLine: string | null = null;
  if (draft.updatedAt) {
    const rel = formatRelativePastFromIso(draft.updatedAt);
    if (rel) {
      editedLine = `Last edited ${rel}`;
    }
  }
  return { performedOnDisplay, editedLine };
}

export type NewSessionDraftCalloutProps = {
  userId: string;
};

export function NewSessionDraftCallout({ userId }: NewSessionDraftCalloutProps) {
  const [isCompactActions, setIsCompactActions] = useState(false);

  useLayoutEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsCompactActions(mediaQuery.matches);
    apply();
    mediaQuery.addEventListener("change", apply);
    return () => mediaQuery.removeEventListener("change", apply);
  }, []);

  /** useSyncExternalStore requires a stable snapshot reference when data is unchanged. */
  const snapshotCacheRef = useRef<{ cacheKey: string; snapshot: DraftSummary | null }>({
    cacheKey: "",
    snapshot: null,
  });

  const summary = useSyncExternalStore(
    (notify) => {
      function onStorage(event: StorageEvent) {
        if (event.key === null || event.key === getNewSessionDraftStorageKey(userId)) {
          notify();
        }
      }
      function onLocalChange() {
        notify();
      }
      window.addEventListener("storage", onStorage);
      window.addEventListener(NEW_SESSION_DRAFT_CHANGED_EVENT, onLocalChange);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(NEW_SESSION_DRAFT_CHANGED_EVENT, onLocalChange);
      };
    },
    () => {
      const next = readDraftSummary(userId);
      const cacheKey = `${userId}:${next == null ? "null" : JSON.stringify(next)}`;
      if (snapshotCacheRef.current.cacheKey === cacheKey) {
        return snapshotCacheRef.current.snapshot;
      }
      snapshotCacheRef.current = { cacheKey, snapshot: next };
      return next;
    },
    () => null,
  );

  function discard() {
    window.localStorage.removeItem(getNewSessionDraftStorageKey(userId));
    notifyNewSessionDraftChanged();
  }

  if (!summary) {
    return null;
  }

  return (
    <div
      className="mb-4 rounded-lg border border-sky-200 bg-sky-50/90 px-3 py-3 text-sm text-sky-950 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
      role="status"
    >
      <div
        className={
          isCompactActions
            ? "flex items-start gap-2"
            : "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
        }
      >
        <div className={`flex gap-2 ${isCompactActions ? "min-w-0 flex-1" : "min-w-0"}`}>
          <FileEdit className="mt-0.5 h-4 w-4 shrink-0 text-sky-800" aria-hidden />
          <div className="min-w-0">
            <p className="font-medium text-sky-950">Draft: new workout session</p>
            <p className="mt-0.5 text-xs text-sky-900/85">
              {summary.editedLine ? `${summary.editedLine} · ` : null}
              Performed on: {summary.performedOnDisplay}
            </p>
          </div>
        </div>
        <div
          className={
            isCompactActions
              ? "flex shrink-0 items-center gap-2 self-start pt-0.5"
              : "flex w-full shrink-0 items-stretch gap-2 sm:w-auto sm:min-w-[17.5rem]"
          }
        >
          <ActionButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={discard}
            aria-label="Discard draft"
            title="Discard draft"
            className={
              isCompactActions
                ? "h-9 w-9 shrink-0 gap-0 px-0"
                : "h-9 min-h-9 flex-1 basis-0 justify-center px-2 sm:min-w-0"
            }
          >
            <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
            <span className={isCompactActions ? "sr-only" : undefined}>Discard draft</span>
          </ActionButton>
          <Link
            href="/sessions/new?resume=1"
            aria-label="Continue to draft"
            title="Continue to draft"
            className={
              isCompactActions
                ? "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-sky-700 bg-sky-700 text-white hover:border-sky-600 hover:bg-sky-600"
                : "inline-flex h-9 min-h-9 flex-1 basis-0 items-center justify-center gap-1.5 rounded-md border border-sky-700 bg-sky-700 px-2 text-sm font-medium text-white hover:border-sky-600 hover:bg-sky-600"
            }
          >
            {!isCompactActions ? (
              <>
                <span>Continue</span>
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
              </>
            ) : (
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}
