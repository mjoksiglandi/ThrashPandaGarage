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
  context?: string;
  href?: string;
  label: string;
  tone?: AdminStatusTone;
  value: number;
};

export function AdminMetric({ context, href, label, tone = "neutral", value }: AdminMetricProps) {
  const content = (
    <>
      <p className="admin-metric__value" style={{ color: valueColors[tone] }}>{value}</p>
      <p className="admin-metric__label">{label}</p>
      {context && <p className="admin-metric__context" style={{ color: tone === "red" ? valueColors.red : undefined }}>{context}</p>}
    </>
  );
  const className = "admin-metric";
  return href ? <Link className={className} href={href}>{content}</Link> : <article className={className}>{content}</article>;
}
