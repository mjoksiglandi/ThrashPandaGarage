import Link from "next/link";
import { GalleryStatus } from "@prisma/client";
import { portalGalleryStatusLabels } from "@/modules/portal/gallery-status-labels";
import {
  listPortalGalleryPhotos,
  requirePortalGallery,
} from "@/modules/portal/portal-access";
import { PortalPhotoGrid } from "./PortalPhotoGrid";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DELIVERY_VISIBLE_STATUSES: GalleryStatus[] = [
  GalleryStatus.READY_FOR_DELIVERY,
  GalleryStatus.DELIVERED,
];

export default async function PortalGalleryDetailPage({
  params,
}: {
  params: Promise<{ galleryId: string }>;
}) {
  const { galleryId } = await params;
  const { gallery } = await requirePortalGallery(galleryId);
  const photos = await listPortalGalleryPhotos(gallery.id);
  const deliveryDriveUrl =
    DELIVERY_VISIBLE_STATUSES.includes(gallery.status) &&
    gallery.deliveryDriveUrl?.trim()
      ? gallery.deliveryDriveUrl
      : null;

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
      {deliveryDriveUrl && (
        <section className="portal-intro">
          <span className="meta">Entrega disponible</span>
          <p>
            <a
              className="portal-gallery-card__action"
              href={deliveryDriveUrl}
              target="_blank"
              rel="noreferrer"
            >
              Ver entrega en Google Drive →
            </a>
          </p>
        </section>
      )}
      {photos.length === 0 ? (
        <section className="portal-gallery-list">
          <div className="portal-empty">
            <h2>Aún no hay fotografías disponibles.</h2>
            <p>Cuando se carguen fotografías para esta galería aparecerán aquí.</p>
          </div>
        </section>
      ) : (
        <PortalPhotoGrid
          galleryId={gallery.id}
          photos={photos}
          selectionOpen={gallery.selectionOpen}
          selectionLimit={gallery.selectionLimit}
        />
      )}
    </main>
  );
}
