import type { ReactNode } from "react";
import { AppFooter } from "@/app/components/app-footer";

type PageShellProps = {
  children: ReactNode;
  className?: string;
};

export function PageShell({ children, className }: PageShellProps) {
  return (
    <main
      className={`mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 pt-6 pb-12 sm:px-6 sm:pt-8 sm:pb-16${
        className ? ` ${className}` : ""
      }`}
    >
      {children}
      <AppFooter />
    </main>
  );
}
