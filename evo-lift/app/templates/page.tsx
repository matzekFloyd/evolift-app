"use client";

import { ArrowLeft, FileStack, Pencil, Play, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/app/components/action-button";
import { DateInput } from "@/app/components/date-input";
import { PageShell } from "@/app/components/page-shell";
import { StatusNotice } from "@/app/components/status-notice";
import { getTodayYyyyMmDd } from "@/lib/session-date";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import { deleteUserTemplate, instantiateUserTemplate } from "@/server/actions/templates";
import type { WorkoutTemplateListItem } from "@/server/db/templates";

export default function TemplatesPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [templates, setTemplates] = useState<WorkoutTemplateListItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"error" | "success">("error");
  const [useDialogTemplateId, setUseDialogTemplateId] = useState<string | null>(null);
  const [usePerformedOn, setUsePerformedOn] = useState("");
  const [useSessionNotes, setUseSessionNotes] = useState("");
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function showError(text: string) {
    setMessageTone("error");
    setMessage(text);
  }

  function clearMessage() {
    setMessage(null);
  }

  async function reloadTemplates() {
    const { data, error } = await supabaseBrowserClient
      .from("workout_templates")
      .select("id, name, notes, created_at, updated_at, workout_template_exercises(id)")
      .order("updated_at", { ascending: false });

    if (error) {
      setLoadError("Could not load templates.");
      return;
    }

    setTemplates(
      (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
        exerciseCount: row.workout_template_exercises?.length ?? 0,
      })),
    );
    setLoadError(null);
  }

  useEffect(() => {
    let isMounted = true;

    async function init() {
      const {
        data: { session },
      } = await supabaseBrowserClient.auth.getSession();
      if (!isMounted) {
        return;
      }
      if (!session) {
        router.replace("/login");
        return;
      }
      await reloadTemplates();
      setUsePerformedOn(getTodayYyyyMmDd());
      setIsChecking(false);
    }

    void init();
    return () => {
      isMounted = false;
    };
  }, [router]);

  function openUseDialog(templateId: string) {
    setUseDialogTemplateId(templateId);
    setUsePerformedOn(getTodayYyyyMmDd());
    setUseSessionNotes("");
    clearMessage();
  }

  async function confirmUseTemplate() {
    if (!useDialogTemplateId || !usePerformedOn) {
      showError("Please choose a performed date.");
      return;
    }
    const {
      data: { session },
    } = await supabaseBrowserClient.auth.getSession();
    if (!session?.access_token) {
      showError("You must be logged in.");
      return;
    }
    setIsStartingSession(true);
    clearMessage();
    try {
      const sessionId = await instantiateUserTemplate({
        accessToken: session.access_token,
        templateId: useDialogTemplateId,
        performedOn: usePerformedOn,
        notes: useSessionNotes.trim() ? useSessionNotes.trim() : null,
      });
      setUseDialogTemplateId(null);
      router.push(`/sessions/${sessionId}`);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Could not start session.");
    } finally {
      setIsStartingSession(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTargetId) {
      return;
    }
    const {
      data: { session },
    } = await supabaseBrowserClient.auth.getSession();
    if (!session?.access_token) {
      showError("You must be logged in.");
      return;
    }
    setIsDeleting(true);
    clearMessage();
    try {
      await deleteUserTemplate(session.access_token, deleteTargetId);
      setDeleteTargetId(null);
      await reloadTemplates();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Could not delete template.");
    } finally {
      setIsDeleting(false);
    }
  }

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }

  if (isChecking) {
    return (
      <PageShell className="items-center justify-center">
        <p className="text-sm text-zinc-600">Checking session...</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="flex items-center justify-between gap-3">
        <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <FileStack className="h-6 w-6 text-sky-700" />
          Templates
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/sessions/new"
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-zinc-50 px-3 text-sm font-medium text-zinc-800 hover:border-sky-300 hover:bg-zinc-100"
          >
            New session
          </Link>
          <ActionButton type="button" onClick={goBack} variant="secondary" size="md">
            <ArrowLeft className="h-4 w-4 text-sky-700" />
            Back
          </ActionButton>
        </div>
      </div>

      <p className="mt-2 text-sm text-zinc-600">
        Save a reusable exercise list with targets. Use a template to start a logged workout session
        in one step, or prefill a planned session from{" "}
        <Link href="/sessions/new" className="font-medium text-sky-800 underline-offset-2 hover:underline">
          New workout session
        </Link>
        .
      </p>

      {message ? (
        <StatusNotice
          message={message}
          tone={messageTone}
          onDismiss={clearMessage}
          className="mt-4"
        />
      ) : null}

      {loadError ? (
        <p className="mt-4 text-sm text-red-600">{loadError}</p>
      ) : templates.length === 0 ? (
        <section className="panel mt-6 p-6 text-center text-sm text-zinc-600">
          <p>No templates yet.</p>
          <Link
            href="/templates/new"
            className="mt-4 inline-flex h-10 items-center justify-center gap-1 rounded-md border border-sky-700 bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:border-sky-600 hover:bg-sky-600 [&_svg]:text-white"
          >
            <Plus className="h-4 w-4 text-white" />
            Create template
          </Link>
        </section>
      ) : (
        <section className="panel mt-6 overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead>
              <tr className="bg-zinc-50/80 text-left text-xs font-medium uppercase tracking-wide text-zinc-600">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Exercises</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {templates.map((row) => (
                <tr key={row.id} className="bg-white">
                  <td className="px-4 py-3 font-medium text-zinc-900">{row.name}</td>
                  <td className="px-4 py-3 text-zinc-600">{row.exerciseCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openUseDialog(row.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-sky-700 bg-sky-700 px-2 py-1 text-xs font-medium text-white hover:border-sky-600 hover:bg-sky-600"
                      >
                        <Play className="h-3.5 w-3.5 text-white" />
                        Use
                      </button>
                      <Link
                        href={`/templates/${row.id}/edit`}
                        className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-800 hover:border-sky-300 hover:bg-zinc-100"
                      >
                        <Pencil className="h-3.5 w-3.5 text-sky-700" />
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeleteTargetId(row.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-800 hover:border-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-600" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {templates.length > 0 ? (
        <div className="mt-6 flex justify-end">
          <Link
            href="/templates/new"
            className="inline-flex h-10 items-center justify-center gap-1 rounded-md border border-sky-700 bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:border-sky-600 hover:bg-sky-600 [&_svg]:text-white"
          >
            <Plus className="h-4 w-4 text-white" />
            Create template
          </Link>
        </div>
      ) : null}

      {useDialogTemplateId ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="use-template-title"
        >
          <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 shadow-lg">
            <h2 id="use-template-title" className="text-base font-semibold text-zinc-900">
              Start session from template
            </h2>
            <p className="mt-1 text-xs text-zinc-600">
              Creates a workout session with this template&apos;s exercises and targets. You can
              still edit before logging sets.
            </p>
            <label className="mt-4 block text-sm font-medium text-zinc-800">
              Performed on
              <DateInput
                required
                value={usePerformedOn}
                onChange={(e) => setUsePerformedOn(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </label>
            <label className="mt-3 block text-sm font-medium text-zinc-800">
              Session notes (optional)
              <textarea
                value={useSessionNotes}
                onChange={(e) => setUseSessionNotes(e.target.value)}
                className="mt-1 h-20 w-full rounded-md border px-3 py-2 text-sm"
                maxLength={500}
                placeholder="Optional notes for this session"
              />
            </label>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setUseDialogTemplateId(null)}
                className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-800 hover:border-sky-300 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isStartingSession}
                onClick={() => void confirmUseTemplate()}
                className="rounded-md border border-sky-700 bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:border-sky-600 hover:bg-sky-600 disabled:opacity-60"
              >
                {isStartingSession ? "Starting…" : "Start session"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTargetId ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-template-title"
        >
          <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-4 shadow-lg">
            <h2 id="delete-template-title" className="text-base font-semibold text-zinc-900">
              Delete template?
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              This removes the template only. Existing workout sessions stay unchanged.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-800 hover:border-sky-300 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void confirmDelete()}
                className="rounded-md border border-red-600 bg-red-600 px-3 py-2 text-sm font-medium text-white hover:border-red-700 hover:bg-red-700 disabled:opacity-60"
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
