"use client";

import Link from "next/link";
import { BarChart3, Dumbbell, House, LogOut, UserRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AppHeaderNavLink,
  appHeaderNavIconInactiveClassName,
  appHeaderNavIconInactiveGlyphClassName,
} from "@/app/components/app-header-nav-link";
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
          <AppHeaderNavLink href="/" label="Home" isActive={pathname === "/"} icon={House} />
          <AppHeaderNavLink
            href="/exercises"
            label="Exercises"
            isActive={pathname.startsWith("/exercises")}
            icon={Dumbbell}
          />
          <AppHeaderNavLink
            href="/insights"
            label="Insights"
            isActive={pathname.startsWith("/insights")}
            icon={BarChart3}
          />
          <AppHeaderNavLink
            href="/account"
            label="Account"
            isActive={pathname === "/account"}
            icon={UserRound}
            title={userEmail ? `Account — ${userEmail}` : "Account"}
          />
          <button
            type="button"
            onClick={handleAuthClick}
            className={appHeaderNavIconInactiveClassName}
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className={appHeaderNavIconInactiveGlyphClassName} aria-hidden />
          </button>
        </div>
      </nav>
    </header>
  );
}
