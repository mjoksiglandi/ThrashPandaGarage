"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useFormStatus } from "react-dom";

const items = [
  { href: "/admin", label: "Dashboard", mark: "◨" },
  { href: "/admin/galleries", label: "Galerías", mark: "▦" },
  { href: "/admin/clients", label: "Clientes", mark: "◍" },
];

const systemItems = [{ href: "/work", label: "Portfolio", mark: "↗", external: true }];

export function AdminSidebar({
  adminEmail,
  onLogout,
  attentionCount = 0,
}: {
  adminEmail: string;
  onLogout: () => Promise<void>;
  attentionCount?: number;
}) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const initial = adminEmail.slice(0, 1).toUpperCase();
  const currentSection = items.find((item) => isActive(item.href))?.label ?? "Administración";

  function isActive(href: string) {
    if (href === "/admin") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      <header className="admin-topbar">
        <Link href="/admin" className="admin-topbar__brand" onClick={() => setOpen(false)}>TRASHPANDA</Link>
        <nav aria-label="Ubicación" className="admin-topbar__crumbs">
          <Link href="/admin">Admin</Link><span aria-hidden="true">/</span><span>{currentSection}</span>
        </nav>
        <Link className="button admin-topbar__cta" href="/admin/galleries/new">+ Nueva galería</Link>
        <button
          type="button"
          className="secondary admin-menu-button"
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
        className={`admin-sidebar ${open ? "is-open" : ""}`}
      >
      <Link href="/admin" className="admin-sidebar__logo">
        TRASHPANDA<span>—</span>GARAGE
      </Link>
      <p className="admin-sidebar__section">Operación</p>
      <nav className="admin-sidebar__nav">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={() => setOpen(false)}
            className={active ? "is-active" : undefined}
          >
            <span className="admin-sidebar__icon">{item.mark}</span>
            {item.label}
            {item.href === "/admin/galleries" && attentionCount > 0 && (
              <span className="admin-sidebar__badge">{attentionCount}</span>
            )}
          </Link>
          );
        })}
      </nav>
      <p className="admin-sidebar__section">Sistema</p>
      <nav className="admin-sidebar__nav">
        {systemItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            <span className="admin-sidebar__icon">{item.mark}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <form action={onLogout} className="admin-sidebar__footer">
        <div className="admin-sidebar__identity">
          <span className="admin-sidebar__avatar">
            {initial}
          </span>
          <div className="min-w-0">
            <p>{adminEmail}</p>
            <small>admin</small>
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
  return <button className="admin-sidebar__logout" disabled={pending} type="submit">{pending ? "Saliendo…" : "Salir"}</button>;
}
