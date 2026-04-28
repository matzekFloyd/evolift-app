"use client";

import { Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/browser";

export default function Home() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
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

      setUserEmail(session.user.email ?? null);
      setAccessToken(session.access_token ?? null);
      setIsChecking(false);
    }

    void checkSession();

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function handleCopyToken() {
    if (!accessToken) {
      return;
    }
    await navigator.clipboard.writeText(accessToken);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  if (isChecking) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-sm text-zinc-600">Checking session...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Welcome to Evo Lift</h1>
      <p className="text-sm text-zinc-600">
        Logged in as {userEmail ?? "unknown user"}.
      </p>
      <section className="panel p-5">
        <h2 className="text-lg font-medium">Home placeholder</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Dashboard content will be added here next.
        </p>
      </section>
      <section className="panel space-y-2 p-5 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Access token</h2>
          <button
            type="button"
            onClick={handleCopyToken}
            disabled={!accessToken}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs disabled:opacity-60"
            aria-label="Copy access token"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <textarea
          readOnly
          value={accessToken ?? "none"}
          className="h-32 w-full rounded-md border bg-white px-2 py-1 font-mono text-xs"
        />
      </section>
    </main>
  );
}
