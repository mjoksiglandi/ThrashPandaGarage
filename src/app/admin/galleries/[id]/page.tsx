import { GalleryStatus } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { AdminShell } from "@/components/admin/AdminShell";
import { GalleryPhotoManager } from "@/components/admin/GalleryPhotoManager";
import { GalleryStatusBadge, galleryStatusLabels } from "@/components/admin/GalleryStatusBadge";
import { FormField } from "@/components/ui/FormField";
import { requireAdmin } from "@/lib/auth";
import { env } from "@/lib/env";
import { clientRepository } from "@/modules/clients/client.repository";
import { galleryRepository } from "@/modules/galleries/gallery.repository";
import { archiveGallery, transitionGallery, updateGalleryFromForm } from "@/modules/galleries/gallery.service";
import { allowedGalleryTransitions } from "@/modules/galleries/gallery-workflow";
import { resendGalleryInvitation, sendInitialGalleryInvitation } from "@/modules/mail/mail.service";
import { canResendInvitation, canSendInitialInvitation } from "@/modules/mail/mail-workflow";
import { importGalleryPhotosAction } from "./actions";

export const dynamic = "force-dynamic";

const statusDescriptions: Record<GalleryStatus, string> = {
  DRAFT: "Preparación interna. El cliente aún no recibió acceso.",
  EMAIL_SENT: "La invitación fue enviada; falta abrir la selección.",
  PROOFING: "El cliente puede revisar y seleccionar fotografías.",
  SELECTION_CONFIRMED: "El cliente cerró su selección.",
  EDITING: "La selección está en edición final.",
  READY_FOR_DELIVERY: "La entrega está preparada y pendiente de marcar como entregada.",
  DELIVERED: "La entrega fue completada.",
  ARCHIVED: "Galería cerrada; no admite nuevas operaciones.",
};

const eventLabels: Record<string, string> = {
  GALLERY_CREATED: "Galería creada",
  GALLERY_UPDATED: "Datos actualizados",
  STATUS_CHANGED: "Estado actualizado",
  GALLERY_ARCHIVED: "Galería archivada",
  PHOTOS_IMPORTED: "Fotografías importadas",
  GALLERY_EMAIL_SENT: "Invitación enviada",
  GALLERY_EMAIL_RESENT: "Invitación reenviada",
  PHOTO_SELECTION_UPDATED: "Selección modificada",
  SELECTION_CONFIRMED: "Selección confirmada",
};

function actionError(fallback: string) {
  return `${fallback} Verifica los datos e inténtalo nuevamente.`;
}

function eventSummary(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const values = metadata as Record<string, unknown>;
  if (typeof values.importedCount === "number") {
    return `${values.importedCount} nuevas, ${values.updatedCount ?? 0} actualizadas, ${values.skippedCount ?? 0} sin cambios.`;
  }
  if (typeof values.fromStatus === "string" && typeof values.toStatus === "string") {
    return `${galleryStatusLabels[values.fromStatus as GalleryStatus] ?? values.fromStatus} → ${galleryStatusLabels[values.toStatus as GalleryStatus] ?? values.toStatus}`;
  }
  return null;
}

export default async function GalleryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { id } = await params;
  const message = await searchParams;
  const [gallery, clients] = await Promise.all([galleryRepository.find(id), clientRepository.list()]);
  if (!gallery) redirect("/admin/galleries");

  async function update(formData: FormData) {
    "use server";
    const admin = await requireAdmin();
    let target = `/admin/galleries/${id}?success=saved`;
    try {
      await updateGalleryFromForm(id, formData, { actorId: admin.id });
    } catch {
      target = `/admin/galleries/${id}?error=${encodeURIComponent(actionError("No se pudo guardar la galería."))}`;
    }
    redirect(target);
  }

  async function sendInitialInvitation() {
    "use server";
    const admin = await requireAdmin();
    let target = `/admin/galleries/${id}?success=email-sent`;
    try {
      await sendInitialGalleryInvitation({ galleryId: id, actorId: admin.id });
    } catch {
      target = `/admin/galleries/${id}?error=${encodeURIComponent("No se pudo enviar la invitación. Revisa el correo del cliente y la configuración SMTP.")}`;
    }
    redirect(target);
  }

  async function resendInvitation() {
    "use server";
    const admin = await requireAdmin();
    let target = `/admin/galleries/${id}?success=email-resent`;
    try {
      await resendGalleryInvitation({ galleryId: id, actorId: admin.id });
    } catch {
      target = `/admin/galleries/${id}?error=${encodeURIComponent("No se pudo reenviar la invitación. Revisa el correo del cliente y la configuración SMTP.")}`;
    }
    redirect(target);
  }

  async function archive() {
    "use server";
    const admin = await requireAdmin();
    let target = `/admin/galleries/${id}?success=archived`;
    try {
      await archiveGallery(id, { actorId: admin.id });
    } catch {
      target = `/admin/galleries/${id}?error=${encodeURIComponent(actionError("No se pudo archivar la galería."))}`;
    }
    redirect(target);
  }

  async function changeStatus(formData: FormData) {
    "use server";
    const admin = await requireAdmin();
    const next = GalleryStatus[String(formData.get("status")) as keyof typeof GalleryStatus];
    let target = `/admin/galleries/${id}?success=status-changed`;
    try {
      if (!next) throw new Error("invalid status");
      await transitionGallery(id, next, { actorId: admin.id });
    } catch {
      target = `/admin/galleries/${id}?error=${encodeURIComponent(actionError("No se pudo cambiar el estado."))}`;
    }
    redirect(target);
  }

  const selected = gallery.selections.filter((selection) => selection.selected);
  const transitions = allowedGalleryTransitions(gallery.status);
  const selectionLimitLocked = gallery.selectionConfirmedAt !== null || ([
    GalleryStatus.SELECTION_CONFIRMED,
    GalleryStatus.EDITING,
    GalleryStatus.READY_FOR_DELIVERY,
    GalleryStatus.DELIVERED,
    GalleryStatus.ARCHIVED,
  ] as GalleryStatus[]).includes(gallery.status);
  const publicUrl = `${env.APP_BASE_URL}/g/${gallery.accessToken}`;

  const successMessages: Record<string, string> = {
    created: "Galería creada correctamente. Completa la configuración antes de importar o enviar acceso.",
    saved: "Galería guardada correctamente.",
    "email-sent": `Invitación enviada a ${gallery.client.email ?? "el cliente"}.`,
    "email-resent": `Invitación reenviada a ${gallery.client.email ?? "el cliente"}.`,
    archived: "Galería archivada. Ya no admite nuevas operaciones.",
    "status-changed": `Estado actualizado a ${galleryStatusLabels[gallery.status]}.`,
    imported: `Importación terminada: ${message.imported ?? 0} nuevas, ${message.updated ?? 0} actualizadas y ${message.skipped ?? 0} sin cambios.`,
  };

  return (
    <AdminShell>
      <Link href="/admin/galleries" className="text-sm text-zinc-500 hover:text-zinc-300">← Volver a galerías</Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500">Centro operativo</p>
          <h1 className="mt-1 text-3xl font-black">{gallery.title}</h1>
          <p className="mt-2 text-zinc-500">{gallery.client.name}</p>
        </div>
        <GalleryStatusBadge status={gallery.status} />
      </div>

      {message.error && <p role="alert" className="mt-4 rounded-lg border border-red-900 bg-red-950/40 p-4 text-red-300">{message.error}</p>}
      {message.success && successMessages[message.success] && <p role="status" className="mt-4 rounded-lg border border-emerald-900 bg-emerald-950/40 p-4 text-emerald-300">{successMessages[message.success]}</p>}

      <section aria-label="Resumen de la galería" className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Cliente" value={gallery.client.name} detail={gallery.client.email ?? "Sin correo configurado"} />
        <Summary label="Estado" value={galleryStatusLabels[gallery.status]} detail={statusDescriptions[gallery.status]} />
        <Summary label="Fotos" value={`${gallery.photos.length}`} detail={gallery.photos.length ? "fotografías disponibles" : "Pendiente de importación"} />
        <Summary label="Selección" value={`${selected.length} seleccionadas`} detail={gallery.selectionConfirmedAt ? `Confirmada ${gallery.selectionConfirmedAt.toLocaleString("es-CL")}` : "Aún no confirmada"} />
        <Summary label="Límite" value={gallery.selectionLimit ? `${gallery.selectionLimit} fotos` : "Sin límite"} detail={selectionLimitLocked ? "Bloqueado por el estado actual" : "Se puede editar"} />
        <Summary label="Acceso" value={gallery.emailSentAt ? "Invitación enviada" : "Aún no enviado"} detail={gallery.expiresAt ? `Expira ${gallery.expiresAt.toLocaleDateString("es-CL")}` : "Sin vencimiento"} />
        <Summary label="Entrega" value={gallery.deliveryDriveUrl ? "Enlace configurado" : "Pendiente"} detail={gallery.deliveredAt ? `Entregada ${gallery.deliveredAt.toLocaleString("es-CL")}` : "Aún no entregada"} />
        <Summary label="Historial" value={`${gallery.events.length} eventos`} detail={gallery.events[0] ? `Último: ${eventLabels[gallery.events[0].type] ?? gallery.events[0].type}` : "Sin actividad registrada"} />
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <AdminActionForm action={update} className="grid gap-4 rounded-lg border border-zinc-800 bg-[#141417] p-5" label="Guardar galería" pendingLabel="Guardando…">
          <h2 className="text-xl font-bold">Configuración</h2>
          <FormField label="Cliente"><select name="clientId" defaultValue={gallery.clientId}>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></FormField>
          <FormField label="Título"><input name="title" defaultValue={gallery.title} required /></FormField>
          <FormField label="Slug"><input name="slug" defaultValue={gallery.slug} /></FormField>
          <FormField label="Límite de selección"><input name="selectionLimit" type="number" min="1" defaultValue={gallery.selectionLimit ?? ""} readOnly={selectionLimitLocked} /></FormField>
          <FormField label="Expira"><input name="expiresAt" type="date" defaultValue={gallery.expiresAt?.toISOString().slice(0, 10) ?? ""} /></FormField>
          <FormField label="Ruta local de originales"><input name="proofingLocalPath" defaultValue={gallery.proofingLocalPath ?? ""} /></FormField>
          <FormField label="Ruta local de miniaturas"><input name="thumbnailLocalPath" defaultValue={gallery.thumbnailLocalPath ?? ""} /></FormField>
          <FormField label="Ruta local de previews"><input name="previewLocalPath" defaultValue={gallery.previewLocalPath ?? ""} /></FormField>
          <FormField label="Carpeta de trabajo en Drive"><input name="googleDriveFolderUrl" defaultValue={gallery.googleDriveFolderUrl ?? ""} /></FormField>
          <FormField label="Enlace de entrega en Drive"><input name="deliveryDriveUrl" defaultValue={gallery.deliveryDriveUrl ?? ""} /></FormField>
        </AdminActionForm>

        <aside className="grid content-start gap-3">
          <section className="grid gap-3 rounded-lg border border-zinc-800 bg-[#141417] p-4">
            <div><h2 className="font-bold">Estado actual</h2><div className="mt-2"><GalleryStatusBadge status={gallery.status} /></div><p className="mt-3 text-sm text-zinc-400">{statusDescriptions[gallery.status]}</p></div>
            {transitions.length > 0 ? (
              <AdminActionForm action={changeStatus} className="grid gap-3" confirmMessage="¿Cambiar el estado de esta galería?" label="Aplicar transición" pendingLabel="Actualizando…">
                <select name="status" required defaultValue=""><option value="" disabled>Selecciona el siguiente estado</option>{transitions.map((status) => <option key={status} value={status}>{galleryStatusLabels[status]}</option>)}</select>
              </AdminActionForm>
            ) : <p className="text-sm text-zinc-500">No hay más transiciones disponibles.</p>}
          </section>

          <section className="grid gap-2 rounded-lg border border-zinc-800 bg-[#141417] p-4">
            <h2 className="font-bold">Acceso</h2>
            <Link className="break-all text-sm text-[#d9902f]" href={`/g/${gallery.accessToken}`} target="_blank" rel="noopener noreferrer">Abrir galería del cliente ↗</Link>
            <p className="break-all text-xs text-zinc-500">{publicUrl}</p>
          </section>

          {gallery.status !== GalleryStatus.ARCHIVED && <AdminActionForm action={importGalleryPhotosAction.bind(null, id)} buttonClassName="w-full" label="Importar fotos" pendingLabel="Importando…" />}
          {canSendInitialInvitation(gallery.status) && <AdminActionForm action={sendInitialInvitation} buttonClassName="secondary w-full" confirmMessage={`¿Enviar la invitación a ${gallery.client.email ?? "este cliente"}?`} label="Enviar invitación" pendingLabel="Enviando…" />}
          {canResendInvitation(gallery.status) && <AdminActionForm action={resendInvitation} buttonClassName="secondary w-full" confirmMessage={`¿Reenviar la invitación a ${gallery.client.email ?? "este cliente"}?`} label="Reenviar invitación" pendingLabel="Enviando…" />}

          <section className="rounded-lg border border-zinc-800 bg-[#141417] p-4">
            <h2 className="font-bold">Selección</h2>
            <p className="mt-1 text-sm text-zinc-400">{selected.length} de {gallery.selectionLimit ?? "sin límite"} fotos</p>
            {selected.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">El cliente todavía no ha seleccionado fotografías. La exportación estará disponible cuando exista una selección.</p>
            ) : (
              <><div className="mt-4 grid gap-2"><a className="button secondary text-center" href={`/admin/galleries/${id}/export`}>Exportar TXT</a><a className="button secondary text-center" href={`/admin/galleries/${id}/export/csv`}>Exportar CSV</a></div>
              <ul className="mt-4 grid gap-2 text-sm">{selected.map((selection) => <li key={selection.id} className="rounded border border-zinc-800 p-2"><strong>{selection.photo.baseName}</strong>{selection.comment && <p className="mt-1 text-zinc-400">{selection.comment}</p>}</li>)}</ul></>
            )}
          </section>

          {gallery.status !== GalleryStatus.ARCHIVED && <AdminActionForm action={archive} buttonClassName="secondary w-full" confirmMessage="¿Archivar esta galería? Se cerrará el acceso operativo y no podrás importar más fotos." label="Archivar galería" pendingLabel="Archivando…" />}
        </aside>
      </div>

      <GalleryPhotoManager photos={gallery.photos} />

      <section className="mt-8">
        <h2 className="text-xl font-bold">Historial</h2>
        <p className="mt-1 text-sm text-zinc-500">Actividad administrativa y del cliente, de más reciente a más antigua.</p>
        <ul className="mt-4 grid gap-2 text-sm text-zinc-400">
          {gallery.events.map((event) => <li key={event.id} className="rounded border border-zinc-800 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-zinc-200">{eventLabels[event.type] ?? event.type}</strong><time className="font-mono text-xs text-zinc-500">{event.createdAt.toLocaleString("es-CL")}</time></div>{eventSummary(event.metadata) && <p className="mt-1 text-zinc-500">{eventSummary(event.metadata)}</p>}<p className="mt-1 text-xs text-zinc-600">Origen: {event.actorType === "ADMIN" ? "Administración" : event.actorType === "SYSTEM" ? "Sistema" : "Cliente"}</p></li>)}
          {gallery.events.length === 0 && <li className="rounded border border-dashed border-zinc-700 p-6 text-center text-zinc-500">Todavía no hay actividad registrada.</li>}
        </ul>
      </section>
    </AdminShell>
  );
}

function Summary({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="rounded-lg border border-zinc-800 bg-[#141417] p-4"><p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p><p className="mt-2 font-semibold text-zinc-200">{value}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{detail}</p></article>;
}
