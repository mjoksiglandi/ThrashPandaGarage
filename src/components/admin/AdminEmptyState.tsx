import Link from "next/link";

type AdminEmptyStateProps = {
  actionHref?: string;
  actionLabel?: string;
  description: string;
  title: string;
};

export function AdminEmptyState({ actionHref, actionLabel, description, title }: AdminEmptyStateProps) {
  return (
    <div className="grid min-h-64 place-items-center px-6 py-12 text-center">
      <div className="max-w-md">
        <span aria-hidden="true" className="mx-auto block h-8 w-8 rounded-full border border-dashed border-[var(--line-strong)]" />
        <h2 className="mt-5 text-xl font-light">{title}</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">{description}</p>
        {actionHref && actionLabel && <Link className="button mt-6 inline-flex" href={actionHref}>{actionLabel}</Link>}
      </div>
    </div>
  );
}
