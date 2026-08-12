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
    <header className="admin-page-header">
      <AdminBreadcrumbs items={breadcrumbs} />
      <div className="admin-page-header__row">
        <div className="min-w-0">
          {eyebrow && <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">{eyebrow}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1>{title}</h1>
            {status}
          </div>
          {description && <p className="admin-page-header__description">{description}</p>}
        </div>
        {actions && <div className="admin-page-header__actions">{actions}</div>}
      </div>
    </header>
  );
}
