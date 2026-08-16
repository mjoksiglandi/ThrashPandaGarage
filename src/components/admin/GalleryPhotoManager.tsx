import type { Photo, Selection } from "@prisma/client";
import { AdminEmptyState } from "./AdminEmptyState";
import { AdminPanel } from "./AdminPanel";
import { AdminStatusChip } from "./AdminStatusChip";

type PhotoWithSelection = Photo & { selection: Selection | null };

export function GalleryPhotoManager({ photos }: { photos: PhotoWithSelection[] }) {
  return (
    <AdminPanel className="mt-8" description={`${photos.length} ${photos.length === 1 ? "fotografía" : "fotografías"}`} title="Fotos">
      {photos.length === 0 ? (
        <AdminEmptyState description="Configura las rutas locales y usa Importar fotos para sincronizarlas." title="Esta galería todavía no tiene fotos" />
      ) : (
        <div className="admin-photo-grid">
          {photos.map((photo) => (
            <article key={photo.id} className="admin-photo-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/photos/${photo.id}?variant=thumb`} alt={photo.baseName} />
              <div className="admin-photo-card__meta">
                <p>{photo.filename}</p>
                {photo.selection?.selected && <AdminStatusChip tone="violet">Cliente</AdminStatusChip>}
              </div>
              {photo.selection?.comment && <p className="admin-photo-card__comment">{photo.selection.comment}</p>}
            </article>
          ))}
        </div>
      )}
    </AdminPanel>
  );
}
