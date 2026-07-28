import type { Metadata } from "next";
import Link from "next/link";
import { PasswordResetClient } from "./PasswordResetClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Restablecer contraseña",
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AccountPasswordResetPage() {
  return (
    <main className="login-stage">
      <div className="login-stage__background" aria-hidden="true" />
      <div className="login-stage__fade" aria-hidden="true" />
      <Link className="login-stage__logo" href="/">
        TRASHPANDA<span>—</span>GARAGE
      </Link>
      <section aria-label="Restablecer contraseña" className="login-card">
        <PasswordResetClient />
        <footer className="login-card__footer">
          <Link href="/contact">Necesito ayuda</Link>
        </footer>
      </section>
      <span className="login-stage__copyright">
        © 2026 Trashpanda Garage
      </span>
    </main>
  );
}
