import type { ReactNode } from "react";

type AppTableProps = {
  children: ReactNode;
  tableClassName?: string;
  className?: string;
};

export function AppTable({ children, tableClassName, className }: AppTableProps) {
  return (
    <div
      className={`overflow-x-auto rounded-md border border-zinc-200 bg-white${
        className ? ` ${className}` : ""
      }`}
    >
      <table className={`w-full text-left text-sm${tableClassName ? ` ${tableClassName}` : ""}`}>
        {children}
      </table>
    </div>
  );
}
