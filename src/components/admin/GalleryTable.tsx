import Link from "next/link";
import type { Client, Gallery, Photo, Selection } from "@prisma/client";
import { AdminTable } from "./AdminTable";
import { GalleryStatusBadge } from "./GalleryStatusBadge";

type GalleryListItem = Gallery & { client: Client; photos: Pick<Photo, "id">[]; selections: Selection[] };

export function GalleryTable({ galleries }: { galleries: GalleryListItem[] }) {
  return (
    <AdminTable headers={["Galería", "Cliente", "Estado", "Fotos", "Selección", ""]}>
      {galleries.map((gallery) => (
        <tr key={gallery.id} className="transition-colors hover:bg-white/[0.025]">
          <td className="px-5 py-4"><Link className="font-medium text-[var(--foreground)] hover:text-[var(--accent)]" href={`/admin/galleries/${gallery.id}`}>{gallery.title}</Link><p className="mt-0.5 font-mono text-[9px] text-[var(--muted-2)]">{gallery.slug}</p></td>
          <td className="px-5 py-4 text-[var(--muted)]">{gallery.client.name}</td>
          <td className="px-5 py-4"><GalleryStatusBadge status={gallery.status} /></td>
          <td className="px-5 py-4 font-mono text-xs text-[var(--muted)]">{gallery.photos.length}</td>
          <td className="px-5 py-4 font-mono text-xs text-[var(--muted)]">{gallery.selections.filter((selection) => selection.selected).length}{gallery.selectionLimit ? ` / ${gallery.selectionLimit}` : ""}</td>
          <td className="px-5 py-4 text-right"><Link className="secondary inline-flex px-3 py-1.5 text-xs" href={`/admin/galleries/${gallery.id}`}>Ver</Link></td>
        </tr>
      ))}
    </AdminTable>
  );
}
