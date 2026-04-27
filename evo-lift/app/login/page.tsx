"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isSignedIn = Boolean(accessToken);

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      const {
        data: { session },
      } = await supabaseBrowserClient.auth.getSession();

      if (!isMounted) {
        return;
      }

      setAccessToken(session?.access_token ?? null);
      setUserEmail(session?.user.email ?? null);
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabaseBrowserClient.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? null);
      setUserEmail(session?.user.email ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const { data, error } = await supabaseBrowserClient.auth.signInWithPassword(
      {
        email,
        password,
      },
    );

    if (error) {
      setMessage(error.message);
      setIsLoading(false);
      return;
    }

    setAccessToken(data.session?.access_token ?? null);
    setUserEmail(data.user?.email ?? null);
    setMessage("Logged in successfully.");
    setIsLoading(false);
  }

  async function handleLogout() {
    setIsLoading(true);
    setMessage(null);

    const { error } = await supabaseBrowserClient.auth.signOut();
    if (error) {
      setMessage(error.message);
      setIsLoading(false);
      return;
    }

    setAccessToken(null);
    setUserEmail(null);
    setPassword("");
    setMessage("Logged out.");
    setIsLoading(false);
  }

  async function handleCopyToken() {
    if (!accessToken) {
      return;
    }

    try {
      await navigator.clipboard.writeText(accessToken);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setMessage("Could not copy token. Please copy it manually.");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-14">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Login</h1>
        <p className="text-sm text-zinc-600">
          Sign in with Supabase Auth to get a user session token.
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4 rounded-xl border p-4">
        <label className="block text-sm font-medium">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            readOnly={isSignedIn}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm read-only:bg-zinc-100 read-only:text-zinc-600"
            placeholder="you@example.com"
          />
        </label>

        <label className="block text-sm font-medium">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            readOnly={isSignedIn}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm read-only:bg-zinc-100 read-only:text-zinc-600"
            placeholder="Your password"
          />
        </label>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isLoading || isSignedIn}
            className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {isLoading ? "Please wait..." : "Sign in"}
          </button>
          <button
            type="button"
            disabled={isLoading || !accessToken}
            onClick={handleLogout}
            className="rounded-md border px-4 py-2 text-sm disabled:opacity-60"
          >
            Sign out
          </button>
        </div>
      </form>

      <section className="space-y-2 rounded-xl border p-4 text-sm">
        <h2 className="font-medium">Session</h2>
        <p>
          <span className="font-medium">User:</span> {userEmail ?? "not logged in"}
        </p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">Access token</span>
            <button
              type="button"
              disabled={!accessToken}
              onClick={handleCopyToken}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs disabled:opacity-60"
              aria-label="Copy access token"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <textarea
            readOnly
            value={accessToken ?? "none"}
            className="h-32 w-full rounded-md border bg-white px-2 py-1 font-mono text-xs"
          />
        </div>
        <p className="text-zinc-600">
          `/docs` should auto-use your current token. You can still copy it manually.
        </p>
      </section>

      {message ? <p className="text-sm">{message}</p> : null}

      <Link className="text-sm underline" href="/docs">
        Open API docs
      </Link>
    </main>
  );
}
