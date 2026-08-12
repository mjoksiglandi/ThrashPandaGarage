import { GalleryStatus } from "@prisma/client";
import { AdminMetric } from "@/components/admin/AdminMetric";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminShell } from "@/components/admin/AdminShell";
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
        breadcrumbs={[{ label: "Admin" }, { label: "Dashboard" }]}
        description="Resumen de clientes, galerías y estados operativos con datos actuales."
        eyebrow="Centro operativo"
        title="Dashboard"
      />
      <section aria-label="Métricas del estudio" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <AdminMetric href="/admin/clients" label="Clientes" value={clients.length} />
        <AdminMetric href="/admin/galleries" label="Galerías" value={galleries.length} />
        <AdminMetric href="/admin/galleries?status=PROOFING" label="Selección abierta" tone="blue" value={count(GalleryStatus.PROOFING)} />
        <AdminMetric href="/admin/galleries?status=SELECTION_CONFIRMED" label="Selección confirmada" tone="violet" value={count(GalleryStatus.SELECTION_CONFIRMED)} />
        <AdminMetric href="/admin/galleries?status=READY_FOR_DELIVERY" label="Listas para entrega" tone="green" value={count(GalleryStatus.READY_FOR_DELIVERY)} />
        <AdminMetric href="/admin/galleries?status=closed" label="Entregadas / archivadas" value={count(GalleryStatus.DELIVERED, GalleryStatus.ARCHIVED)} />
      </section>
    </AdminShell>
  );
}
