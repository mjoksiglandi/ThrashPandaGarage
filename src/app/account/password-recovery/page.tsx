import type { Metadata } from "next";
import Link from "next/link";
import { PasswordRecoveryClient } from "./PasswordRecoveryClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Recuperar contraseña",
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AccountPasswordRecoveryPage() {
  return (
    <main className="login-stage">
      <div className="login-stage__background" aria-hidden="true" />
      <div className="login-stage__fade" aria-hidden="true" />
      <Link className="login-stage__logo" href="/">
        TRASHPANDA<span>—</span>GARAGE
      </Link>
      <section aria-label="Recuperar contraseña" className="login-card">
        <PasswordRecoveryClient />
        <footer className="login-card__footer">
          <Link href="/login">Volver al inicio de sesión</Link>
        </footer>
      </section>
      <span className="login-stage__copyright">
        © 2026 Trashpanda Garage
      </span>
    </main>
  );
}
