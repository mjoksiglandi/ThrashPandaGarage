import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { galleryRepository } from "@/modules/galleries/gallery.repository";

export const dynamic = "force-dynamic";

export default async function GalleriesPage() {
  const galleries = await galleryRepository.list();
  return (
    <AdminShell>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-black">Galerias</h1>
        <Link className="button" href="/admin/galleries/new">Nueva galeria</Link>
      </div>
      <div className="mt-6 overflow-hidden rounded-lg border border-zinc-800">
        {galleries.map((gallery) => (
          <Link key={gallery.id} href={`/admin/galleries/${gallery.id}`} className="grid gap-2 border-b border-zinc-800 bg-[#141417] p-4 last:border-b-0 md:grid-cols-[1fr_auto]">
            <div>
              <strong>{gallery.title}</strong>
              <p className="text-sm text-zinc-500">{gallery.client.name} · {gallery.photos.length} fotos · {gallery.selections.filter((s) => s.selected).length} seleccionadas</p>
            </div>
            <StatusBadge status={gallery.status} />
          </Link>
        ))}
        {galleries.length === 0 && <p className="p-4 text-zinc-500">No hay galerias todavia.</p>}
      </div>
    </AdminShell>
  );
}
