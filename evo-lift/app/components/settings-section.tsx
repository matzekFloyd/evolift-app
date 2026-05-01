import type { ReactNode } from "react";

type SettingsSectionProps = {
  children: ReactNode;
  className?: string;
};

type SettingsSectionBodyProps = {
  children: ReactNode;
  className?: string;
};

export function SettingsSection({ children, className }: SettingsSectionProps) {
  return <section className={`panel px-5 py-6 text-sm ${className ?? ""}`.trim()}>{children}</section>;
}

export function SettingsSectionBody({ children, className }: SettingsSectionBodyProps) {
  return <div className={className ?? "mt-3"}>{children}</div>;
}
