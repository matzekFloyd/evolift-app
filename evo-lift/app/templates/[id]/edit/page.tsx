"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageShell } from "@/app/components/page-shell";
import { supabaseBrowserClient } from "@/lib/supabase/browser";
import { getUserTemplateById } from "@/server/actions/templates";
import type { WorkoutTemplateWithExercises } from "@/server/db/templates";
import { TemplateEditorClient } from "@/app/templates/template-editor-client";

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const templateId = typeof params.id === "string" ? params.id : "";
  const [initial, setInitial] = useState<WorkoutTemplateWithExercises | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const {
        data: { session },
      } = await supabaseBrowserClient.auth.getSession();
      if (!isMounted) {
        return;
      }
      if (!session?.access_token || !templateId) {
        router.replace("/login");
        return;
      }

      try {
        const row = await getUserTemplateById(session.access_token, templateId);
        if (!isMounted) {
          return;
        }
        if (!row) {
          setError("Template not found.");
          return;
        }
        setInitial(row);
      } catch {
        if (isMounted) {
          setError("Could not load template.");
        }
      }
    }

    void load();
    return () => {
      isMounted = false;
    };
  }, [router, templateId]);

  if (error) {
    return (
      <PageShell className="items-center justify-center">
        <p className="text-sm text-red-600">{error}</p>
      </PageShell>
    );
  }

  if (!initial) {
    return (
      <PageShell className="items-center justify-center">
        <p className="text-sm text-zinc-600">Loading template...</p>
      </PageShell>
    );
  }

  return <TemplateEditorClient mode="edit" templateId={templateId} initial={initial} />;
}
