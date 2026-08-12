import type { ReactNode } from "react";

export function AdminTable({ children, headers }: { children: ReactNode; headers: ReactNode[] }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--line)] bg-black/10">
            {headers.map((header, index) => (
              <th key={index} className="px-5 py-3 font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-[var(--muted-2)]">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--line)]">{children}</tbody>
      </table>
    </div>
  );
}
