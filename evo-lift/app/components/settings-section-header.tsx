import type { ReactNode } from "react";

type SettingsSectionHeaderProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
};

export function SettingsSectionHeader({
  title,
  description,
  icon,
}: SettingsSectionHeaderProps) {
  return (
    <>
      <h2 className="inline-flex items-center gap-2 text-base font-semibold tracking-tight text-zinc-900">
        {icon}
        {title}
      </h2>
      {description ? (
        <p className="mt-1.5 max-w-prose text-sm leading-snug text-zinc-600">{description}</p>
      ) : null}
    </>
  );
}
