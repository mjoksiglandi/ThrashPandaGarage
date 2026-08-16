import type { ReactNode } from "react";

export type AdminStatusTone = "neutral" | "blue" | "violet" | "amber" | "green" | "red";

const tones: Record<AdminStatusTone, string> = {
  neutral: "#7c8794",
  blue: "#6f9ed6",
  violet: "#a58ddd",
  amber: "#d9a34f",
  green: "#76b99a",
  red: "#d77a7a",
};

export function AdminStatusChip({ children, tone = "neutral" }: { children: ReactNode; tone?: AdminStatusTone }) {
  const color = tones[tone];
  return (
    <span className="admin-status-chip" style={{ color }}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 7px ${color}` }} />
      {children}
    </span>
  );
}
