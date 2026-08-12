import type { ReactNode } from "react";

type AdminPanelProps = {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: string;
  title?: string;
};

export function AdminPanel({ actions, children, className, description, title }: AdminPanelProps) {
  return (
    <section className={["rounded-[8px] border border-[var(--line)] bg-[var(--panel)]", className].filter(Boolean).join(" ")}>
      {(title || description || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div>
            {title && <h2 className="text-base font-normal text-[var(--foreground)]">{title}</h2>}
            {description && <p className="mt-1 text-xs text-[var(--muted-2)]">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
