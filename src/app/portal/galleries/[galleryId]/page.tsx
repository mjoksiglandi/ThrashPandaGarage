import Link from "next/link";
import { portalGalleryStatusLabels } from "@/modules/portal/gallery-status-labels";
import { requirePortalGallery } from "@/modules/portal/portal-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PortalGalleryDetailPage({
  params,
}: {
  params: Promise<{ galleryId: string }>;
}) {
  const { galleryId } = await params;
  const { gallery } = await requirePortalGallery(galleryId);

  return (
    <main className="portal-page">
      <header className="portal-header">
        <Link className="wordmark" href="/">
          TRASHPANDA<span>—</span>GARAGE
        </Link>
        <Link className="portal-logout" href="/portal">
          ← Volver al portal
        </Link>
      </header>
      <section className="portal-intro">
        <span className="meta">{portalGalleryStatusLabels[gallery.status]}</span>
        <h1>{gallery.title}</h1>
        <p>
          {gallery.createdAt.toLocaleDateString("es-CL", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </section>
      <section className="portal-gallery-list">
        <div className="portal-empty">
          <h2>Fotografías próximamente</h2>
          <p>Esta vista mostrará las fotografías de la galería una vez esté disponible su carga autenticada.</p>
        </div>
      </section>
    </main>
  );
}
