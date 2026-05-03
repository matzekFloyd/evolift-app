import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type AppHeaderNavLinkProps = {
  href: string;
  label: string;
  isActive: boolean;
  icon: LucideIcon;
  /** Tooltip; defaults to `label`. */
  title?: string;
};

/**
 * Header nav control (icon only at all breakpoints). Active: filled sky; icon is always
 * explicit `text-white` on active so it cannot inherit the sky focus ring color. Focus:
 * inactive uses sky ring + white offset; active uses white ring + sky offset so the glyph
 * stays visible on compact viewports.
 */
export function AppHeaderNavLink({ href, label, isActive, icon: Icon, title: titleProp }: AppHeaderNavLinkProps) {
  const title = titleProp ?? label;
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      title={title}
      aria-label={label}
      className={
        isActive
          ? "inline-flex items-center rounded-md bg-sky-700 p-2 text-white hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-sky-700"
          : "inline-flex items-center rounded-md bg-white p-2 text-zinc-700 hover:bg-zinc-200/80 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      }
    >
      <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-sky-800"}`} aria-hidden />
    </Link>
  );
}
