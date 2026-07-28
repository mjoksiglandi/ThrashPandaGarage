import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
  },
};

export default function InvitationAcceptedPage() {
  return (
    <main className="login-stage">
      <div className="login-stage__background" aria-hidden="true" />
      <div className="login-stage__fade" aria-hidden="true" />
      <Link className="login-stage__logo" href="/">
        TRASHPANDA<span>—</span>GARAGE
      </Link>
      <section className="login-card">
        <header className="login-card__header">
          <span className="meta">Cuenta activada</span>
          <h1>Tu acceso está listo.</h1>
          <p>
            La contraseña quedó definida y la invitación ya fue utilizada.
            Puedes cerrar esta ventana.
          </p>
        </header>
        <footer className="login-card__footer">
          <Link href="/">Volver al inicio</Link>
        </footer>
      </section>
      <span className="login-stage__copyright">
        © 2026 Trashpanda Garage
      </span>
    </main>
  );
}
