"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useFormStatus } from "react-dom";

const items = [
  { href: "/admin", label: "Dashboard", mark: "D" },
  { href: "/admin/clients", label: "Clientes", mark: "C" },
  { href: "/admin/galleries", label: "Galerías", mark: "G" },
  { href: "/work", label: "Portfolio", mark: "↗", external: true },
];

export function AdminSidebar({ adminEmail, onLogout }: { adminEmail: string; onLogout: () => Promise<void> }) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const initial = adminEmail.slice(0, 1).toUpperCase();
  const currentSection = items.find((item) => !item.external && isActive(item.href))?.label ?? "Administración";

  function isActive(href: string) {
    if (href === "/admin") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-[var(--line)] bg-[#101318]/95 px-4 backdrop-blur md:left-[240px] md:px-8">
        <Link href="/admin" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <span className="brand-mark h-[18px] w-[18px] md:hidden" />
          <span className="text-sm font-semibold tracking-[0.02em] md:hidden">TRASHPANDA</span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted-2)] md:inline">Panel administrativo</span>
          <span aria-hidden="true" className="hidden text-[var(--line-strong)] md:inline">/</span>
          <span className="hidden text-sm text-[var(--foreground)] md:inline">{currentSection}</span>
        </Link>
        <button
          type="button"
          className="secondary px-3 py-2 md:hidden"
          aria-controls="admin-navigation"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? "Cerrar" : "Menú"}
        </button>
      </header>
      {open && (
        <button
          type="button"
          aria-label="Cerrar navegación"
          className="fixed inset-0 z-40 bg-black/70 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        id="admin-navigation"
        className={`fixed inset-y-0 left-0 z-50 w-[min(86vw,280px)] border-r border-[var(--line)] bg-[#101318] p-4 md:flex md:w-[240px] md:flex-col ${open ? "flex flex-col" : "hidden"}`}
      >
      <Link href="/admin" className="mb-5 flex items-center gap-3 border-b border-[var(--line)] px-2 pb-6 pt-1">
        <span className="brand-mark h-[18px] w-[18px]" />
        <span><span className="block text-sm font-semibold tracking-[0.02em]">TRASHPANDA</span><span className="mt-0.5 block font-mono text-[8px] uppercase tracking-[0.2em] text-[var(--muted-2)]">Garage admin</span></span>
      </Link>
      <p className="mb-2 px-3 font-mono text-[8px] uppercase tracking-[0.18em] text-[var(--muted-2)]">Navegación</p>
      <nav className="grid gap-0.5 text-sm">
        {items.map((item) => {
          const active = !item.external && isActive(item.href);
          return (
          <Link
            key={item.href}
            href={item.href}
            target={item.external ? "_blank" : undefined}
            rel={item.external ? "noopener noreferrer" : undefined}
            aria-current={active ? "page" : undefined}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-[5px] border px-3 py-2.5 transition-colors ${
              active ? "border-[var(--line)] bg-white/[0.055] text-[var(--foreground)]" : "border-transparent text-[var(--muted)] hover:bg-white/[0.035] hover:text-[var(--foreground)]"
            }`}
          >
            <span className={`grid h-6 w-6 place-items-center rounded-[4px] font-mono text-[9px] ${active ? "bg-[var(--accent)]/20 text-[#bca9ea]" : "bg-white/[0.035] text-[var(--muted-2)]"}`}>{item.mark}</span>
            {item.label}
          </Link>
          );
        })}
      </nav>
      <form action={onLogout} className="mt-auto border-t border-[var(--line)] px-2 pb-1 pt-4">
        <div className="mb-4 flex items-center gap-3">
          <span className="mono grid h-7 w-7 place-items-center rounded-full bg-[#26262b] text-xs text-[#d8d6dd]">
            {initial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs text-[var(--foreground)]">{adminEmail}</p>
            <p className="text-[11px] text-[var(--muted-2)]">admin</p>
          </div>
        </div>
        <LogoutButton />
      </form>
      </aside>
    </>
  );
}

function LogoutButton() {
  const { pending } = useFormStatus();
  return <button className="secondary w-full disabled:cursor-wait disabled:opacity-50" disabled={pending} type="submit">{pending ? "Saliendo…" : "Salir"}</button>;
}
