"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/browser";

export function HeaderActions() {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
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
      setIsReady(true);
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabaseBrowserClient.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(Boolean(session));
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
    <header className="border-b bg-white/90">
      <nav className="mx-auto flex w-full max-w-5xl items-center justify-end px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
          <Link
            className={`rounded px-2 py-1 text-sm font-medium ${
              pathname === "/"
                ? "bg-zinc-900 text-white"
                : "text-zinc-700 hover:bg-zinc-100"
            }`}
            href="/"
          >
            App
          </Link>
          <Link
            className={`rounded px-2 py-1 text-sm font-medium ${
              pathname === "/docs"
                ? "bg-zinc-900 text-white"
                : "text-zinc-700 hover:bg-zinc-100"
            }`}
            href="/docs"
          >
            Docs
          </Link>
          <button
            type="button"
            onClick={handleAuthClick}
            className="rounded-md border px-3 py-1.5 text-sm font-medium"
          >
            Log out
          </button>
        </div>
      </nav>
    </header>
  );
}
