"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useFormStatus } from "react-dom";

const items = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/clients", label: "Clientes" },
  { href: "/admin/galleries", label: "Galerias" },
  { href: "/work", label: "Portfolio", external: true },
];

export function AdminSidebar({ adminEmail, onLogout }: { adminEmail: string; onLogout: () => Promise<void> }) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const initial = adminEmail.slice(0, 1).toUpperCase();

  function isActive(href: string) {
    if (href === "/admin") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-[var(--line)] bg-[#111216]/95 px-4 backdrop-blur md:hidden">
        <Link href="/admin" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <span className="brand-mark h-[18px] w-[18px]" />
          <span className="text-sm font-semibold tracking-[0.02em]">TRASHPANDA</span>
        </Link>
        <button
          type="button"
          className="secondary px-3 py-2"
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
        className={`fixed inset-y-0 left-0 z-50 w-[min(86vw,280px)] border-r border-[var(--line)] bg-[#111216] p-4 md:flex md:w-[230px] md:flex-col ${open ? "flex flex-col" : "hidden"}`}
      >
      <Link href="/admin" className="mb-4 flex items-center gap-3 border-b border-[var(--line)] px-2 pb-6">
        <span className="brand-mark h-[18px] w-[18px]" />
        <span className="text-sm font-semibold tracking-[0.02em]">TRASHPANDA</span>
      </Link>
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
            className={`flex items-center gap-3 rounded-[4px] px-3 py-2.5 ${
              active ? "bg-white/[0.05] text-[var(--foreground)]" : "text-[var(--muted)] hover:bg-white/[0.04]"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[var(--accent)]" : "bg-transparent"}`} />
            {item.label}
          </Link>
          );
        })}
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
