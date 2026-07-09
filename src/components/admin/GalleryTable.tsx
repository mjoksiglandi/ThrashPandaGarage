import Link from "next/link";
import type { Client, Gallery, Photo, Selection } from "@prisma/client";
import { GalleryStatusBadge } from "./GalleryStatusBadge";

type GalleryListItem = Gallery & { client: Client; photos: Pick<Photo, "id">[]; selections: Selection[] };

export function GalleryTable({ galleries }: { galleries: GalleryListItem[] }) {
  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-zinc-800">
      {galleries.map((gallery) => (
        <Link
          key={gallery.id}
          href={`/admin/galleries/${gallery.id}`}
          className="grid gap-2 border-b border-zinc-800 bg-[#141417] p-4 last:border-b-0 md:grid-cols-[1fr_auto]"
        >
          <div>
            <strong>{gallery.title}</strong>
            <p className="text-sm text-zinc-500">
              {gallery.client.name} · {gallery.photos.length} fotos ·{" "}
              {gallery.selections.filter((s) => s.selected).length} seleccionadas
            </p>
          </div>
          <GalleryStatusBadge status={gallery.status} />
        </Link>
      ))}
      {galleries.length === 0 && <p className="p-4 text-zinc-500">No hay galerias todavia.</p>}
    </div>
  );
}
