import type { Metadata } from "next";
import Link from "next/link";
import { AccountLoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Iniciar sesión",
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AccountLoginPage() {
  return (
    <main className="login-stage">
      <div className="login-stage__background" aria-hidden="true" />
      <div className="login-stage__fade" aria-hidden="true" />
      <Link className="login-stage__logo" href="/">
        TRASHPANDA<span>—</span>GARAGE
      </Link>
      <section aria-labelledby="account-login-title" className="login-card">
        <header className="login-card__header">
          <span className="meta">Cuenta Trashpanda</span>
          <h1 id="account-login-title">Bienvenido de vuelta.</h1>
          <p>Ingresa con el correo y la contraseña de tu cuenta.</p>
        </header>
        <AccountLoginForm />
        <footer className="login-card__footer">
          <Link href="/account/password-recovery">
            ¿Olvidaste tu contraseña?
          </Link>
          <p className="password-reset-login">
            <Link href="/admin/login">¿Eres administrador? Ingresa aquí</Link>
          </p>
        </footer>
      </section>
      <span className="login-stage__copyright">
        © 2026 Trashpanda Garage
      </span>
    </main>
  );
}
