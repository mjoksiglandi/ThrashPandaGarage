import { GalleryStatus } from "@prisma/client";
import Link from "next/link";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminToolbar } from "@/components/admin/AdminToolbar";
import { GalleryTable } from "@/components/admin/GalleryTable";
import { galleryStatusLabels } from "@/components/admin/GalleryStatusBadge";
import { requireAdmin } from "@/lib/auth";
import { galleryRepository } from "@/modules/galleries/gallery.repository";

export const dynamic = "force-dynamic";

type GallerySearchParams = { q?: string; status?: string };

export function filterGalleries<
  T extends { client: { name: string }; status: GalleryStatus; title: string }
>(galleries: T[], q: string, status: string) {
  const normalizedQuery = q.trim().toLocaleLowerCase("es");
  return galleries.filter((gallery) => {
    const matchesQuery = !normalizedQuery || [gallery.title, gallery.client.name]
      .some((value) => value.toLocaleLowerCase("es").includes(normalizedQuery));
    const matchesStatus = status === "closed"
      ? ([GalleryStatus.DELIVERED, GalleryStatus.ARCHIVED] as GalleryStatus[]).includes(gallery.status)
      : Object.values(GalleryStatus).includes(status as GalleryStatus) ? gallery.status === status : true;
    return matchesQuery && matchesStatus;
  });
}

export default async function GalleriesPage({ searchParams }: { searchParams: Promise<GallerySearchParams> }) {
  await requireAdmin();
  const { q = "", status = "all" } = await searchParams;
  const galleries = await galleryRepository.list();
  const visibleGalleries = filterGalleries(galleries, q, status);

  return (
    <AdminShell>
      <AdminPageHeader
        actions={<Link className="button" href="/admin/galleries/new">Nueva galería</Link>}
        breadcrumbs={[{ href: "/admin", label: "Admin" }, { label: "Galerías" }]}
        description={`${galleries.length} ${galleries.length === 1 ? "galería registrada" : "galerías registradas"}`}
        eyebrow="Producción"
        title="Galerías"
      />
      <AdminPanel className="overflow-hidden">
        <AdminToolbar placeholder="Buscar por galería o cliente…" query={q} resetHref="/admin/galleries">
          <select className="!w-full !rounded-[5px] !border !border-[var(--line)] !bg-black/10 !px-3 !py-2.5 text-sm md:!w-56" defaultValue={status} name="status">
            <option value="all">Todos los estados</option>
            {Object.values(GalleryStatus).map((value) => <option key={value} value={value}>{galleryStatusLabels[value]}</option>)}
            <option value="closed">Entregadas o archivadas</option>
          </select>
        </AdminToolbar>
        {visibleGalleries.length > 0 ? <GalleryTable galleries={visibleGalleries} /> : (
          <AdminEmptyState
            actionHref={galleries.length ? "/admin/galleries" : "/admin/galleries/new"}
            actionLabel={galleries.length ? "Limpiar filtros" : "Crear primera galería"}
            description={galleries.length ? "Ajusta la búsqueda o el estado para ver otros resultados." : "Crea una galería y asóciala a un cliente existente."}
            title={galleries.length ? "No encontramos galerías" : "Todavía no hay galerías"}
          />
        )}
      </AdminPanel>
    </AdminShell>
  );
}
