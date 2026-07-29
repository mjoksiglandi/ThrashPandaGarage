"use client";

import Link from "next/link";

export default function AccountSessionsError() {
  return (
    <main className="portal-page">
      <section className="portal-intro">
        <span className="meta">Seguridad de la cuenta</span>
        <h1>No pudimos cargar tus sesiones.</h1>
        <p>Inténtalo nuevamente en unos momentos.</p>
        <Link className="portal-gallery-card__action" href="/portal">
          Volver al portal
        </Link>
      </section>
    </main>
  );
}
