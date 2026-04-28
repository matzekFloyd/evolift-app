"use client";

import Link from "next/link";
import { Dumbbell, House, LogOut } from "lucide-react";
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
    <header className="border-b bg-white/90">
      <nav className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <Link
          href="/account"
          className={`inline-flex min-w-0 max-w-[40%] items-center gap-2 rounded px-2 py-1 text-xs sm:max-w-none sm:text-sm ${
            pathname === "/account"
              ? "bg-zinc-900 text-white"
              : "text-zinc-700 hover:bg-amber-100 hover:text-amber-900"
          }`}
          title={`Logged in as ${userEmail ?? "unknown user"}`}
        >
          <Dumbbell
            className={`h-4 w-4 shrink-0 ${
              pathname === "/account" ? "text-white" : "text-amber-700"
            }`}
          />
          <span className="truncate">{userEmail ?? "unknown user"}</span>
        </Link>
        <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-4">
          <Link
            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium sm:text-sm ${
              pathname === "/"
                ? "bg-zinc-900 text-white"
                : "text-zinc-700 hover:bg-zinc-100"
            }`}
            href="/"
          >
            <House className="h-3.5 w-3.5" />
            Home
          </Link>
          <button
            type="button"
            onClick={handleAuthClick}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium sm:px-3 sm:text-sm"
          >
            <LogOut className="h-3.5 w-3.5" />
            Log out
          </button>
        </div>
      </nav>
    </header>
  );
}
