import { GalleryStatus } from "@prisma/client";
import Link from "next/link";
import { AdminMetric } from "@/components/admin/AdminMetric";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { AdminShell } from "@/components/admin/AdminShell";
import { GalleryStatusBadge } from "@/components/admin/GalleryStatusBadge";
import { requireAdmin } from "@/lib/auth";
import { clientRepository } from "@/modules/clients/client.repository";
import { galleryRepository } from "@/modules/galleries/gallery.repository";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const [clients, galleries] = await Promise.all([clientRepository.list(), galleryRepository.list()]);
  const count = (...statuses: GalleryStatus[]) => galleries.filter((gallery) => statuses.includes(gallery.status)).length;

  return (
    <AdminShell>
      <AdminPageHeader
        actions={<><Link className="secondary" href="/admin/clients/new">+ Cliente</Link><Link className="button" href="/admin/galleries/new">+ Nueva galería</Link></>}
        breadcrumbs={[{ label: "Admin" }, { label: "Dashboard" }]}
        description="Resumen de clientes, galerías y estados operativos con datos actuales."
        title="Dashboard"
      />
      <section aria-label="Métricas del estudio" className="admin-metrics">
        <AdminMetric href="/admin/clients" label="Clientes" value={clients.length} />
        <AdminMetric href="/admin/galleries" label="Galerías" value={galleries.length} />
        <AdminMetric href="/admin/galleries?status=PROOFING" label="Selección abierta" tone="blue" value={count(GalleryStatus.PROOFING)} />
        <AdminMetric href="/admin/galleries?status=SELECTION_CONFIRMED" label="Selección confirmada" tone="violet" value={count(GalleryStatus.SELECTION_CONFIRMED)} />
        <AdminMetric href="/admin/galleries?status=READY_FOR_DELIVERY" label="Listas para entrega" tone="green" value={count(GalleryStatus.READY_FOR_DELIVERY)} />
        <AdminMetric href="/admin/galleries?status=closed" label="Entregadas / archivadas" value={count(GalleryStatus.DELIVERED, GalleryStatus.ARCHIVED)} />
      </section>
      <div className="admin-dashboard-grid">
        <AdminPanel actions={<Link className="font-mono text-[10px] tracking-[0.1em] text-[var(--accent)]" href="/admin/galleries">Ver todas →</Link>} title="Galerías recientes">
          {galleries.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Galería</th><th>Cliente</th><th>Estado</th><th>Fotos</th><th></th></tr></thead>
                <tbody>{galleries.slice(0, 5).map((gallery) => (
                  <tr key={gallery.id}>
                    <td><strong className="font-normal text-[var(--foreground)]">{gallery.title}</strong></td>
                    <td className="text-[var(--muted)]">{gallery.client?.name ?? "Sin cliente"}</td>
                    <td><GalleryStatusBadge status={gallery.status} /></td>
                    <td className="font-mono text-xs text-[var(--muted)]">{gallery.photos?.length ?? 0}</td>
                    <td className="text-right"><Link className="secondary inline-flex px-3 py-1.5 text-xs" href={`/admin/galleries/${gallery.id}`}>Abrir</Link></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="admin-list-summary">Todavía no hay galerías.</p>}
        </AdminPanel>
        <AdminPanel actions={<Link className="font-mono text-[10px] tracking-[0.1em] text-[var(--accent)]" href="/admin/clients">Ver todos →</Link>} title="Clientes recientes">
          {clients.length ? <ul className="divide-y divide-[var(--line)]">
            {clients.slice(0, 5).map((client) => <li key={client.id} className="flex items-center justify-between gap-4 px-4 py-3"><div className="min-w-0"><Link className="block truncate text-sm text-[var(--foreground)] hover:text-[var(--accent)]" href={`/admin/clients/${client.id}`}>{client.name}</Link><p className="mt-0.5 truncate font-mono text-[10px] text-[var(--muted-2)]">{client.email ?? "Sin correo"}</p></div><span className="font-mono text-[10px] text-[var(--muted-2)]">{client.galleries?.length ?? 0} gal.</span></li>)}
          </ul> : <p className="admin-list-summary">Todavía no hay clientes.</p>}
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
