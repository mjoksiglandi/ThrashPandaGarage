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
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {photos.map((photo) => (
            <article key={photo.id} className="overflow-hidden rounded-[6px] border border-[var(--line)] bg-black/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/photos/${photo.id}?variant=thumb`} alt={photo.baseName} className="aspect-[4/3] w-full object-cover" />
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm text-[var(--foreground)]">{photo.filename}</p>
                  {photo.selection?.selected && <AdminStatusChip tone="violet">Seleccionada</AdminStatusChip>}
                </div>
                {photo.selection?.comment && <p className="mt-2 line-clamp-2 text-xs text-[var(--muted-2)]">{photo.selection.comment}</p>}
              </div>
            </article>
          ))}
        </div>
      )}
    </AdminPanel>
  );
}
