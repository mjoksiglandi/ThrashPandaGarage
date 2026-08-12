import Link from "next/link";

export type AdminBreadcrumbItem = {
  href?: string;
  label: string;
};

export function AdminBreadcrumbs({ items }: { items: AdminBreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden="true" className="text-[var(--line-strong)]">/</span>}
            {item.href ? (
              <Link className="transition-colors hover:text-[var(--accent)]" href={item.href}>{item.label}</Link>
            ) : (
              <span aria-current="page" className="text-[var(--foreground)]">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
