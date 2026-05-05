"use client";

import Link from "next/link";
import { BarChart3, Dumbbell, House, LogOut, Menu, UserRound, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const [isCompactMenuOpen, setIsCompactMenuOpen] = useState(false);
  const [compactMenuPanelAnchor, setCompactMenuPanelAnchor] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const compactMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const compactMenuFirstItemRef = useRef<HTMLAnchorElement | null>(null);

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

  useEffect(() => {
    if (!isCompactMenuOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCompactMenu({ returnFocus: true });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    const focusTimer = window.setTimeout(() => {
      compactMenuFirstItemRef.current?.focus();
    }, 0);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [isCompactMenuOpen]);

  useLayoutEffect(() => {
    if (!isCompactMenuOpen) {
      setCompactMenuPanelAnchor(null);
      return;
    }
    function updateAnchor() {
      const trigger = compactMenuTriggerRef.current;
      if (!trigger) {
        return;
      }
      const rect = trigger.getBoundingClientRect();
      setCompactMenuPanelAnchor({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    updateAnchor();
    window.addEventListener("resize", updateAnchor);
    window.addEventListener("scroll", updateAnchor, true);
    return () => {
      window.removeEventListener("resize", updateAnchor);
      window.removeEventListener("scroll", updateAnchor, true);
    };
  }, [isCompactMenuOpen]);

  if (!isReady || !isLoggedIn) {
    return null;
  }

  async function handleAuthClick() {
    await supabaseBrowserClient.auth.signOut();
    router.replace("/login");
  }

  function closeCompactMenu({ returnFocus }: { returnFocus: boolean }) {
    setIsCompactMenuOpen(false);
    if (returnFocus) {
      window.requestAnimationFrame(() => {
        compactMenuTriggerRef.current?.focus();
      });
    }
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
        <div className="hidden shrink-0 items-center justify-end gap-1 sm:gap-2 md:flex">
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
        <div className="md:hidden">
          <button
            ref={compactMenuTriggerRef}
            type="button"
            onClick={() => setIsCompactMenuOpen((prev) => !prev)}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-md text-zinc-700 hover:bg-sky-100/70 hover:text-sky-900 ${
              isCompactMenuOpen
                ? "relative z-[90] border border-zinc-200 bg-white shadow-md"
                : ""
            }`}
            aria-label={isCompactMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isCompactMenuOpen}
            aria-controls="compact-header-menu"
          >
            {isCompactMenuOpen ? (
              <X className={appHeaderNavIconInactiveGlyphClassName} aria-hidden />
            ) : (
              <Menu className={appHeaderNavIconInactiveGlyphClassName} aria-hidden />
            )}
          </button>
        </div>
      </nav>
      {isCompactMenuOpen ? (
        <div className="md:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => closeCompactMenu({ returnFocus: true })}
            className="fixed inset-0 z-[70] bg-zinc-900/45"
          />
          <div
            id="compact-header-menu"
            role="dialog"
            aria-label="Navigation menu"
            style={
              compactMenuPanelAnchor
                ? {
                    top: compactMenuPanelAnchor.top,
                    right: compactMenuPanelAnchor.right,
                  }
                : undefined
            }
            className="fixed z-[80] w-max max-w-[calc(100vw-0.75rem)] rounded-md border border-zinc-200 bg-white p-1 shadow-lg"
          >
            <div className="space-y-1">
              <Link
                ref={compactMenuFirstItemRef}
                href="/"
                onClick={() => closeCompactMenu({ returnFocus: false })}
                className={`flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${
                  pathname === "/" ? "bg-sky-50 text-sky-900" : "text-zinc-800 hover:bg-zinc-50"
                }`}
              >
                <House className="h-4 w-4 shrink-0" aria-hidden />
                Home
              </Link>
              <Link
                href="/exercises"
                onClick={() => closeCompactMenu({ returnFocus: false })}
                className={`flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${
                  pathname.startsWith("/exercises")
                    ? "bg-sky-50 text-sky-900"
                    : "text-zinc-800 hover:bg-zinc-50"
                }`}
              >
                <Dumbbell className="h-4 w-4 shrink-0" aria-hidden />
                Exercises
              </Link>
              <Link
                href="/insights"
                onClick={() => closeCompactMenu({ returnFocus: false })}
                className={`flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${
                  pathname.startsWith("/insights")
                    ? "bg-sky-50 text-sky-900"
                    : "text-zinc-800 hover:bg-zinc-50"
                }`}
              >
                <BarChart3 className="h-4 w-4 shrink-0" aria-hidden />
                Insights
              </Link>
              <Link
                href="/account"
                onClick={() => closeCompactMenu({ returnFocus: false })}
                className={`flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${
                  pathname === "/account" ? "bg-sky-50 text-sky-900" : "text-zinc-800 hover:bg-zinc-50"
                }`}
              >
                <UserRound className="h-4 w-4 shrink-0" aria-hidden />
                Account
              </Link>
              <button
                type="button"
                onClick={async () => {
                  closeCompactMenu({ returnFocus: false });
                  await handleAuthClick();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50"
              >
                <LogOut className="h-4 w-4 shrink-0" aria-hidden />
                Log out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
