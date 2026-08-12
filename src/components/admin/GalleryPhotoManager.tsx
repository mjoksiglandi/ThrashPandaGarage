import type { Photo, Selection } from "@prisma/client";

type PhotoWithSelection = Photo & { selection: Selection | null };

export function GalleryPhotoManager({ photos }: { photos: PhotoWithSelection[] }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold">Fotos</h2>
      {photos.length === 0 && (
        <div className="mt-4 rounded-lg border border-dashed border-zinc-700 p-8 text-center">
          <p className="font-medium text-zinc-300">Esta galería todavía no tiene fotos.</p>
          <p className="mt-1 text-sm text-zinc-500">Configura las rutas locales y usa “Importar fotos” para cargarlas.</p>
        </div>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {photos.map((photo) => (
          <article key={photo.id} className="rounded-lg border border-zinc-800 bg-[#141417] p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/photos/${photo.id}?variant=thumb`}
              alt={photo.baseName}
              className="aspect-square w-full rounded object-cover"
            />
            <p className="mt-2 truncate text-sm">{photo.filename}</p>
            {photo.selection?.comment && <p className="mt-1 text-xs text-zinc-500">{photo.selection.comment}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
