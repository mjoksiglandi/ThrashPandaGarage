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
import { filterGalleries } from "../admin-list-filters";

export const dynamic = "force-dynamic";

type GallerySearchParams = { q?: string; status?: string };

export default async function GalleriesPage({ searchParams }: { searchParams: Promise<GallerySearchParams> }) {
  await requireAdmin();
  const { q = "", status = "all" } = await searchParams;
  const galleries = await galleryRepository.list();
  const visibleGalleries = filterGalleries(galleries, q, status);

  const tabHref = (value: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (value !== "all") params.set("status", value);
    const query = params.toString();
    return query ? `/admin/galleries?${query}` : "/admin/galleries";
  };

  const statusTabs = Object.values(GalleryStatus)
    .map((value) => ({ value, label: galleryStatusLabels[value], count: galleries.filter((gallery) => gallery.status === value).length }))
    .filter((tab) => tab.count > 0);

  return (
    <AdminShell>
      <AdminPageHeader
        actions={<Link className="button" href="/admin/galleries/new">Nueva galería</Link>}
        breadcrumbs={[{ href: "/admin", label: "Admin" }, { label: "Galerías" }]}
        description={`${galleries.length} ${galleries.length === 1 ? "galería registrada" : "galerías registradas"}`}
        title="Galerías"
      />
      <div className="admin-list-controls">
      <nav aria-label="Filtrar por estado" className="admin-tabs">
        <Link className={status === "all" ? "is-active" : undefined} href={tabHref("all")}>
          Todas<span>{galleries.length}</span>
        </Link>
        {statusTabs.map((tab) => (
          <Link key={tab.value} className={status === tab.value ? "is-active" : undefined} href={tabHref(tab.value)}>
            {tab.label}<span>{tab.count}</span>
          </Link>
        ))}
      </nav>
      <AdminToolbar
        placeholder="Buscar por galería o cliente…"
        preservedParams={status === "all" ? undefined : { status }}
        query={q}
        resetHref="/admin/galleries"
      />
      </div>
      <AdminPanel className="overflow-hidden">
        {visibleGalleries.length > 0 ? (
          <GalleryTable galleries={visibleGalleries} />
        ) : (
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
