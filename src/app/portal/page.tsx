import { GalleryStatus } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutClient, requireClient } from "@/lib/client-auth";
import { isGalleryAccessible } from "@/modules/galleries/gallery.service";

export const dynamic = "force-dynamic";

const statusLabels: Record<GalleryStatus, string> = {
  DRAFT: "Preparación", EMAIL_SENT: "Invitación enviada", PROOFING: "Selección abierta",
  SELECTION_CONFIRMED: "Selección confirmada", EDITING: "En edición",
  READY_FOR_DELIVERY: "Lista para entrega", DELIVERED: "Entregada", ARCHIVED: "Archivada",
};

export default async function ClientPortalPage() {
  const client = await requireClient();
  const galleries = client.galleries.filter(isGalleryAccessible);

  async function logout() {
    "use server";
    await logoutClient();
    redirect("/portal/login");
  }

  return (
    <main className="portal-page">
      <header className="portal-header"><Link className="wordmark" href="/">TRASHPANDA<span>—</span>GARAGE</Link><form action={logout}><button type="submit" className="portal-logout">Cerrar sesión</button></form></header>
      <section className="portal-intro"><span className="meta">Portal clientes</span><h1>Hola, {client.name}.</h1><p>Aquí encontrarás tus sesiones disponibles, selecciones y entregas finales.</p></section>
      <section className="portal-gallery-list">
        {galleries.length === 0 ? <div className="portal-empty"><h2>Aún no hay galerías disponibles.</h2><p>Cuando una sesión esté lista aparecerá aquí.</p></div> : galleries.map((gallery) => (
          <Link className="portal-gallery-card" href={`/g/${gallery.accessToken}`} key={gallery.id}>
            <span className="meta">{statusLabels[gallery.status]}</span><h2>{gallery.title}</h2><p>{gallery.createdAt.toLocaleDateString("es-CL", { year: "numeric", month: "long", day: "numeric" })}</p><span className="portal-gallery-card__action">Abrir galería →</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
