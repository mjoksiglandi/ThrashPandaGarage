import { GalleryStatus } from "@prisma/client";
import Link from "next/link";
import { AdminMetric } from "@/components/admin/AdminMetric";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { AdminShell } from "@/components/admin/AdminShell";
import { GalleryStatusBadge } from "@/components/admin/GalleryStatusBadge";
import { requireAdmin } from "@/lib/auth";
import { clientRepository } from "@/modules/clients/client.repository";
import { eventLabels } from "@/modules/galleries/gallery-event-labels";
import { galleryRepository } from "@/modules/galleries/gallery.repository";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function AdminPage() {
  await requireAdmin();
  const [clients, galleries, events] = await Promise.all([
    clientRepository.list(),
    galleryRepository.list(),
    galleryRepository.recentEvents(6),
  ]);

  const now = new Date().getTime();
  const count = (...statuses: GalleryStatus[]) => galleries.filter((gallery) => statuses.includes(gallery.status)).length;
  const active = galleries.filter(
    (gallery) => gallery.status !== GalleryStatus.ARCHIVED && gallery.status !== GalleryStatus.DELIVERED
  ).length;
  const expiring = galleries.filter(
    (gallery) =>
      gallery.status !== GalleryStatus.ARCHIVED &&
      gallery.expiresAt &&
      gallery.expiresAt.getTime() > now &&
      gallery.expiresAt.getTime() - now < 7 * DAY_MS
  );
  const expiringTomorrow = expiring.filter((gallery) => gallery.expiresAt!.getTime() - now < DAY_MS).length;
  const attention = galleries
    .filter((gallery) => gallery.status === GalleryStatus.PROOFING || gallery.status === GalleryStatus.EDITING)
    .sort((a, b) => (a.expiresAt?.getTime() ?? Infinity) - (b.expiresAt?.getTime() ?? Infinity))
    .slice(0, 5);

  return (
    <AdminShell>
      <AdminPageHeader
        actions={<><Link className="secondary" href="/admin/clients/new">+ Cliente</Link><Link className="button" href="/admin/galleries/new">+ Nueva galería</Link></>}
        breadcrumbs={[{ label: "Admin" }, { label: "Dashboard" }]}
        description={`Resumen operativo · ${new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`}
        title="Dashboard"
      />
      <section aria-label="Métricas del estudio" className="admin-metrics">
        <AdminMetric href="/admin/clients" label="Clientes" value={clients.length} />
        <AdminMetric href="/admin/galleries" label="Galerías activas" value={active} />
        <AdminMetric
          href="/admin/galleries?status=PROOFING"
          label="Selecciones pendientes"
          tone="blue"
          value={count(GalleryStatus.PROOFING)}
        />
        <AdminMetric href="/admin/galleries?status=EDITING" label="En edición" tone="amber" value={count(GalleryStatus.EDITING)} />
        <AdminMetric href="/admin/galleries?status=READY_FOR_DELIVERY" label="Entregas disponibles" tone="green" value={count(GalleryStatus.READY_FOR_DELIVERY)} />
        <AdminMetric
          context={expiringTomorrow > 0 ? `${expiringTomorrow} vence mañana` : undefined}
          href="/admin/galleries"
          label="Próx. a expirar"
          tone={expiring.length > 0 ? "red" : "neutral"}
          value={expiring.length}
        />
      </section>
      <div className="admin-dashboard-grid">
        <AdminPanel actions={<Link className="font-mono text-[10px] tracking-[0.1em] text-[var(--accent)]" href="/admin/galleries">Ver todas →</Link>} title="Galerías que requieren atención">
          {attention.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Galería</th><th>Estado</th><th>Selección</th><th>Vence</th><th></th></tr></thead>
                <tbody>{attention.map((gallery) => {
                  const selected = (gallery.selections ?? []).filter((selection) => selection.selected).length;
                  const pct = gallery.selectionLimit ? Math.min(100, Math.round((selected / gallery.selectionLimit) * 100)) : 0;
                  const dueSoon = gallery.expiresAt && gallery.expiresAt.getTime() - now < 2 * DAY_MS;
                  return (
                    <tr key={gallery.id}>
                      <td>
                        <div className="admin-cell-media">
                          <span className="admin-thumb">
                            {gallery.photos?.[0] && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img alt="" src={`/api/photos/${gallery.photos[0].id}?variant=thumb`} />
                            )}
                          </span>
                          <span className="min-w-0">
                            <strong className="block truncate font-normal text-[var(--foreground)]">{gallery.title}</strong>
                            <span className="block truncate font-mono text-[10px] text-[var(--muted-2)]">{gallery.client?.name ?? "Sin cliente"}</span>
                          </span>
                        </div>
                      </td>
                      <td><GalleryStatusBadge status={gallery.status} /></td>
                      <td className="admin-count font-mono text-xs text-[var(--muted)]">
                        {gallery.selectionLimit ? <><b>{selected}</b>/{gallery.selectionLimit}<span className="admin-progress"><i style={{ width: `${pct}%` }} /></span></> : "—"}
                      </td>
                      <td className="font-mono text-xs" style={{ color: dueSoon ? "#df9090" : "#e1b467" }}>
                        {gallery.expiresAt ? gallery.expiresAt.toLocaleDateString("es-CL") : "—"}
                      </td>
                      <td className="text-right"><Link className="secondary inline-flex px-3 py-1.5 text-xs" href={`/admin/galleries/${gallery.id}`}>Abrir</Link></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          ) : <p className="admin-list-summary">Nada pendiente por ahora.</p>}
        </AdminPanel>
        <AdminPanel title="Actividad reciente">
          {events.length ? (
            <ul className="admin-activity">
              {events.map((event) => (
                <li key={event.id}>
                  <time dateTime={event.createdAt.toISOString()}>
                    {event.createdAt.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                  </time>
                  <div className="min-w-0">
                    <p>{eventLabels[event.type] ?? event.type}</p>
                    <small className="truncate">{event.gallery.client.name} · {event.gallery.title}</small>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="admin-list-summary">Todavía no hay actividad.</p>}
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
