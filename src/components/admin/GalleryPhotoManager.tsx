import type { Photo, Selection } from "@prisma/client";

type PhotoWithSelection = Photo & { selection: Selection | null };

export function GalleryPhotoManager({ photos }: { photos: PhotoWithSelection[] }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold">Fotos</h2>
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
