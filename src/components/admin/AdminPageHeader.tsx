import type { ReactNode } from "react";
import { AdminBreadcrumbs, type AdminBreadcrumbItem } from "./AdminBreadcrumbs";

type AdminPageHeaderProps = {
  actions?: ReactNode;
  breadcrumbs: AdminBreadcrumbItem[];
  description?: string;
  eyebrow?: string;
  status?: ReactNode;
  title: string;
};

export function AdminPageHeader({ actions, breadcrumbs, description, eyebrow, status, title }: AdminPageHeaderProps) {
  return (
    <header className="mb-7 border-b border-[var(--line)] pb-6">
      <AdminBreadcrumbs items={breadcrumbs} />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">{eyebrow}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-light leading-tight tracking-[-0.02em] text-[var(--foreground)] sm:text-[38px]">{title}</h1>
            {status}
          </div>
          {description && <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
