"use client";

import Link from "next/link";
import { Dumbbell, House, LogOut, UserRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/browser";

export function HeaderActions() {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      const {
        data: { session },
      } = await supabaseBrowserClient.auth.getSession();

      if (!isMounted) {
        return;
      }

      setIsLoggedIn(Boolean(session));
      setUserEmail(session?.user.email ?? null);
      setIsReady(true);
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabaseBrowserClient.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(Boolean(session));
      setUserEmail(session?.user.email ?? null);
      setIsReady(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!isReady || !isLoggedIn) {
    return null;
  }

  async function handleAuthClick() {
    await supabaseBrowserClient.auth.signOut();
    router.replace("/login");
  }

  return (
    <header className="border-b border-sky-200 bg-gradient-to-r from-sky-200 via-sky-100 to-sky-50">
      <nav className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <Link
          className="inline-flex items-center rounded px-1 py-1 text-base font-semibold tracking-tight text-zinc-900 hover:text-sky-800"
          href="/"
        >
          EvoLift
        </Link>
        <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
          <Link
            href="/"
            className={`inline-flex items-center rounded-md border p-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/40 focus-visible:ring-offset-1 sm:text-sm ${
              pathname === "/"
                ? "border-sky-700 bg-sky-700 text-white hover:bg-sky-600"
                : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-200/80 hover:text-zinc-900"
            }`}
            title="Home"
            aria-label="Home"
          >
            <House className="h-4 w-4" />
          </Link>
          <Link
            href="/exercises"
            className={`inline-flex items-center rounded-md border p-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/40 focus-visible:ring-offset-1 sm:text-sm ${
              pathname.startsWith("/exercises")
                ? "border-sky-700 bg-sky-700 text-white hover:bg-sky-600"
                : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-200/80 hover:text-zinc-900"
            }`}
            title="Exercises"
            aria-label="Exercises"
          >
            <Dumbbell className="h-4 w-4" />
          </Link>
          <Link
            href="/account"
            className={`inline-flex items-center rounded-md border p-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/40 focus-visible:ring-offset-1 sm:text-sm ${
              pathname === "/account"
                ? "border-sky-700 bg-sky-700 text-white hover:bg-sky-600"
                : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-200/80 hover:text-zinc-900"
            }`}
            title={`Logged in as ${userEmail ?? "unknown user"}`}
            aria-label="Account"
          >
            <UserRound className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={handleAuthClick}
            className="inline-flex items-center rounded-md border border-zinc-300 bg-zinc-50 p-2 text-xs font-medium text-zinc-700 hover:border-zinc-400 hover:bg-zinc-200/80 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/40 focus-visible:ring-offset-1 sm:text-sm"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </nav>
    </header>
  );
}
