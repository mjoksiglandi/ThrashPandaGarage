import Link from "next/link";
import { redirect } from "next/navigation";
import { listActiveAccountSessions } from "@/modules/account-sessions/account-session-management";
import {
  logoutPortalActor,
  requirePortalAccount,
} from "@/modules/portal/portal-access";
import { SessionRevokeButton } from "./SessionRevokeButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(value: Date) {
  return value.toLocaleString("es-CL", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

export default async function AccountSessionsPage() {
  const actor = await requirePortalAccount();
  const sessions = await listActiveAccountSessions(actor);

  async function logout() {
    "use server";
    await logoutPortalActor();
    redirect("/portal/login");
  }

  return (
    <main className="portal-page">
      <header className="portal-header">
        <Link className="wordmark" href="/">
          TRASHPANDA<span>—</span>GARAGE
        </Link>
        <nav className="portal-actions" aria-label="Cuenta">
          <Link className="portal-logout" href="/portal">
            Volver al portal
          </Link>
          <form action={logout}>
            <button type="submit" className="portal-logout">
              Cerrar sesión
            </button>
          </form>
        </nav>
      </header>

      <section className="portal-intro">
        <span className="meta">Seguridad de la cuenta</span>
        <h1>Sesiones activas</h1>
        <p>
          Revisa dónde está abierta tu cuenta y cierra las sesiones que ya no
          necesites.
        </p>
      </section>

      <section className="portal-session-list" aria-label="Sesiones activas">
        {sessions.length === 0 ? (
          <div className="portal-empty">
            <h2>No hay sesiones activas.</h2>
            <p>Vuelve a iniciar sesión para acceder al portal.</p>
          </div>
        ) : (
          sessions.map((session) => (
            <article className="portal-session-card" key={session.id}>
              <div>
                <span className="meta">
                  {session.current ? "Sesión actual" : "Sesión activa"}
                </span>
                <h2>
                  {session.current
                    ? "Este navegador"
                    : "Otra sesión de tu cuenta"}
                </h2>
                <dl>
                  <div>
                    <dt>Creada</dt>
                    <dd>{formatDate(session.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Expira</dt>
                    <dd>{formatDate(session.expiresAt)}</dd>
                  </div>
                </dl>
                {session.current ? (
                  <p className="portal-session-warning">
                    Al cerrarla saldrás inmediatamente del portal.
                  </p>
                ) : null}
              </div>
              <form
                action={`/api/account-sessions/${encodeURIComponent(session.id)}/revoke`}
                method="post"
              >
                <SessionRevokeButton current={session.current} />
              </form>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
