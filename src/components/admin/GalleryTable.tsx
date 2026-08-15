import Link from "next/link";
import type { Client, Gallery, Photo, Selection } from "@prisma/client";
import { AdminTable } from "./AdminTable";
import { GalleryStatusBadge } from "./GalleryStatusBadge";

type GalleryListItem = Gallery & { client: Client; photos: Pick<Photo, "id">[]; selections: Selection[] };

export function GalleryTable({ galleries }: { galleries: GalleryListItem[] }) {
  const headers = [
    "Galería",
    "Cliente",
    "Estado",
    "Fotos",
    "Selección",
    "Vence",
    "",
  ];

  return (
    <AdminTable headers={headers}>
        {galleries.map((gallery) => {
          const selectedCount = gallery.selections.filter((selection) => selection.selected).length;
          const pct = gallery.selectionLimit ? Math.min(100, Math.round((selectedCount / gallery.selectionLimit) * 100)) : 0;
          return (
            <tr key={gallery.id} className="transition-colors hover:bg-white/[0.025]">
              <td>
                <div className="admin-cell-media">
                  <span className="admin-thumb">
                    {gallery.photos[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" src={`/api/photos/${gallery.photos[0].id}?variant=thumb`} />
                    )}
                  </span>
                  <span className="min-w-0">
                    <Link className="block truncate font-medium text-[var(--foreground)] hover:text-[var(--accent)]" href={`/admin/galleries/${gallery.id}`}>{gallery.title}</Link>
                    <span className="block truncate font-mono text-[9px] text-[var(--muted-2)]">{gallery.slug}</span>
                  </span>
                </div>
              </td>
              <td className="text-[var(--muted)]">{gallery.client.name}</td>
              <td><GalleryStatusBadge status={gallery.status} /></td>
              <td className="font-mono text-xs text-[var(--muted)]">{gallery.photos.length}</td>
              <td className="admin-count font-mono text-xs text-[var(--muted)]">
                {gallery.selectionLimit ? (
                  <>
                    <b>{selectedCount}</b>/{gallery.selectionLimit}
                    <span className="admin-progress"><i style={{ width: `${pct}%` }} /></span>
                  </>
                ) : (
                  selectedCount || "—"
                )}
              </td>
              <td className="font-mono text-xs text-[var(--muted)]">{gallery.expiresAt ? gallery.expiresAt.toLocaleDateString("es-CL") : "—"}</td>
              <td className="text-right"><Link className="secondary inline-flex px-3 py-1.5 text-xs" href={`/admin/galleries/${gallery.id}`}>Ver</Link></td>
            </tr>
          );
        })}
    </AdminTable>
  );
}
