import Link from "next/link";

const items = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/clients", label: "Clientes" },
  { href: "/admin/galleries", label: "Galerias" },
  { href: "/work", label: "Portfolio" },
];

export function AdminSidebar({ adminEmail, onLogout }: { adminEmail: string; onLogout: () => Promise<void> }) {
  const initial = adminEmail.slice(0, 1).toUpperCase();

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-[230px] border-r border-[var(--line)] bg-[var(--panel)] p-4 md:flex md:flex-col">
      <Link href="/admin" className="mb-4 flex items-center gap-3 border-b border-[var(--line)] px-2 pb-6">
        <span className="brand-mark h-[18px] w-[18px]" />
        <span className="text-sm font-semibold tracking-[0.02em]">TRASHPANDA</span>
      </Link>
      <nav className="grid gap-0.5 text-sm">
        {items.map((item, index) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-[4px] px-3 py-2.5 ${
              index === 0 ? "bg-white/[0.05] text-[var(--foreground)]" : "text-[var(--muted)] hover:bg-white/[0.04]"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${index === 0 ? "bg-[var(--accent)]" : "bg-transparent"}`} />
            {item.label}
          </Link>
        ))}
      </nav>
      <form action={onLogout} className="mt-auto border-t border-[var(--line)] px-2 py-4">
        <div className="mb-4 flex items-center gap-3">
          <span className="mono grid h-7 w-7 place-items-center rounded-full bg-[#26262b] text-xs text-[#d8d6dd]">
            {initial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs text-[var(--foreground)]">{adminEmail}</p>
            <p className="text-[11px] text-[var(--muted-2)]">admin</p>
          </div>
        </div>
        <button className="secondary w-full" type="submit">Salir</button>
      </form>
    </aside>
  );
}
