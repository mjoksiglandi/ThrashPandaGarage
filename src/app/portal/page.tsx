import Link from "next/link";
import { redirect } from "next/navigation";
import { portalGalleryStatusLabels } from "@/modules/portal/gallery-status-labels";
import {
  logoutPortalActor,
  requirePortalClient,
} from "@/modules/portal/portal-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ClientPortalPage() {
  const { client, galleries } = await requirePortalClient();

  async function logout() {
    "use server";
    await logoutPortalActor();
    redirect("/portal/login");
  }

  return (
    <main className="portal-page">
      <header className="portal-header"><Link className="wordmark" href="/">TRASHPANDA<span>—</span>GARAGE</Link><nav className="portal-actions" aria-label="Cuenta"><Link className="portal-logout" href="/portal/sessions">Sesiones activas</Link><form action={logout}><button type="submit" className="portal-logout">Cerrar sesión</button></form></nav></header>
      <section className="portal-intro"><span className="meta">Portal clientes</span><h1>Hola, {client.name}.</h1><p>Aquí encontrarás tus sesiones disponibles, selecciones y entregas finales.</p></section>
      <section className="portal-gallery-list">
        {galleries.length === 0 ? <div className="portal-empty"><h2>Aún no hay galerías disponibles.</h2><p>Cuando una sesión esté lista aparecerá aquí.</p></div> : galleries.map((gallery) => (
          <Link className="portal-gallery-card" href={`/portal/galleries/${gallery.id}`} key={gallery.id}>
            <span className="meta">{portalGalleryStatusLabels[gallery.status]}</span><h2>{gallery.title}</h2><p>{gallery.createdAt.toLocaleDateString("es-CL", { year: "numeric", month: "long", day: "numeric" })}</p><span className="portal-gallery-card__action">Abrir galería →</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
