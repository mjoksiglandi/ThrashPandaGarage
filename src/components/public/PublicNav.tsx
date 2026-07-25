"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function PublicNav({ active = "" }: { active?: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    ["Sesiones", "/sessions", "sessions"],
    ["Galería", "/work/photo", "photo"],
    ["Servicios", "/services", "services"],
    ["About", "/about", "about"],
    ["Contacto", "/contact", "contact"],
  ];

  return (
    <>
      <header className={`public-nav ${scrolled ? "is-scrolled" : ""}`}>
        <div className="public-nav__inner">
          <Link href="/" className="wordmark">TRASHPANDA<span>—</span>GARAGE</Link>
          <nav className="public-nav__links" aria-label="Navegación principal">
            {links.map(([label, href, key]) => <Link key={key} href={href} className={active === key ? "active" : ""}>{label}</Link>)}
          </nav>
          <div className="public-nav__actions">
            <Link href="/contact" className="outline-btn">Reservar sesión</Link>
            <Link href="/admin/login" className="nav-login">Login</Link>
          </div>
          <button className="menu-button" type="button" aria-label="Abrir menú" onClick={() => setOpen(true)}><span /><span /><span /></button>
        </div>
      </header>
      {open && (
        <div className="mobile-menu">
          <button type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)}>×</button>
          {links.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)}>{label}</Link>)}
          <Link href="/contact" className="accent-link" onClick={() => setOpen(false)}>Reservar sesión</Link>
          <Link href="/admin/login" onClick={() => setOpen(false)}>Login</Link>
        </div>
      )}
    </>
  );
}
