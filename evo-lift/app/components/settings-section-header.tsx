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
      <h2 className="inline-flex items-center gap-1 font-medium">
        {icon}
        {title}
      </h2>
      {description ? <p className="mt-1 text-xs text-zinc-600">{description}</p> : null}
    </>
  );
}
