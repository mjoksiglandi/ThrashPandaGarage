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
    <section className={["admin-panel", className].filter(Boolean).join(" ")}>
      {(title || description || actions) && (
        <header className="admin-panel__header">
          <div>
            {title && <h2>{title}</h2>}
            {description && <p className="mt-1 text-xs text-[var(--muted-2)]">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
