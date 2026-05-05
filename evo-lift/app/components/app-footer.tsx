"use client";

import { usePathname } from "next/navigation";

function shouldHideFooter(pathname: string): boolean {
  if (pathname === "/login") {
    return true;
  }
  if (pathname === "/sessions/new") {
    return true;
  }
  if (/^\/sessions\/[^/]+$/.test(pathname)) {
    return true;
  }
  return false;
}

export function AppFooter() {
  const pathname = usePathname();
  const year = new Date().getFullYear();

  if (shouldHideFooter(pathname)) {
    return null;
  }

  return (
    <footer
      className="mt-2 hidden border-t border-zinc-200 text-xs text-zinc-600 md:block"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="pt-3">
        <p>© {year} Mathias Mayrhofer · EvoLift v4.0</p>
      </div>
    </footer>
  );
}
