import Link from "next/link";

type AdminToolbarProps = {
  placeholder: string;
  preservedParams?: Record<string, string>;
  query?: string;
  resetHref: string;
};

export function AdminToolbar({ placeholder, preservedParams, query = "", resetHref }: AdminToolbarProps) {
  return (
    <form className="admin-toolbar" method="get">
      {Object.entries(preservedParams ?? {}).map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Buscar</span>
        <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-2)]">⌕</span>
        <input className="!rounded-[5px] !border !border-[var(--line)] !bg-black/10 !px-9 !py-2.5 text-sm" defaultValue={query} name="q" placeholder={placeholder} type="search" />
      </label>
      <button className="secondary min-h-10 px-4" type="submit">Aplicar</button>
      {(query || Object.keys(preservedParams ?? {}).length > 0) && <Link className="px-2 text-center text-xs text-[var(--muted)] hover:text-[var(--foreground)]" href={resetHref}>Limpiar</Link>}
    </form>
  );
}
