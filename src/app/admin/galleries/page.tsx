import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { GalleryTable } from "@/components/admin/GalleryTable";
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
      <GalleryTable galleries={galleries} />
    </AdminShell>
  );
}
