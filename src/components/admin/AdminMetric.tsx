import Link from "next/link";
import type { AdminStatusTone } from "./AdminStatusChip";

const valueColors: Record<AdminStatusTone, string> = {
  neutral: "var(--foreground)",
  blue: "#8bb4e8",
  violet: "#b19ae4",
  amber: "#e1b467",
  green: "#8ccbad",
  red: "#df9090",
};

type AdminMetricProps = {
  href?: string;
  label: string;
  tone?: AdminStatusTone;
  value: number;
};

export function AdminMetric({ href, label, tone = "neutral", value }: AdminMetricProps) {
  const content = (
    <>
      <p className="text-[30px] font-light leading-none" style={{ color: valueColors[tone] }}>{value}</p>
      <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--muted-2)]">{label}</p>
    </>
  );
  const className = "block min-h-28 rounded-[8px] border border-[var(--line)] bg-[var(--panel)] p-4 transition-colors hover:border-[var(--line-strong)]";
  return href ? <Link className={className} href={href}>{content}</Link> : <article className={className}>{content}</article>;
}
