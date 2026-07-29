import Link from "next/link";
import { portalGalleryStatusLabels } from "@/modules/portal/gallery-status-labels";
import {
  listPortalGalleryPhotos,
  requirePortalGallery,
} from "@/modules/portal/portal-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PortalGalleryDetailPage({
  params,
}: {
  params: Promise<{ galleryId: string }>;
}) {
  const { galleryId } = await params;
  const { gallery } = await requirePortalGallery(galleryId);
  const photos = await listPortalGalleryPhotos(gallery.id);

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
      {photos.length === 0 ? (
        <section className="portal-gallery-list">
          <div className="portal-empty">
            <h2>Aún no hay fotografías disponibles.</h2>
            <p>Cuando se carguen fotografías para esta galería aparecerán aquí.</p>
          </div>
        </section>
      ) : (
        <section className="portal-photo-grid">
          {photos.map((photo) => (
            <figure className="portal-photo-card" key={photo.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/portal/photos/${photo.id}?variant=thumb`}
                alt={photo.baseName}
                loading="lazy"
              />
            </figure>
          ))}
        </section>
      )}
    </main>
  );
}
