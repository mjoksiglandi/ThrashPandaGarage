import { GalleryStatus } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { GalleryStatusBadge } from "@/components/admin/GalleryStatusBadge";
import { GalleryPhotoManager } from "@/components/admin/GalleryPhotoManager";
import { FormField } from "@/components/ui/FormField";
import { requireAdmin } from "@/lib/auth";
import { env } from "@/lib/env";
import { clientRepository } from "@/modules/clients/client.repository";
import { archiveGallery, transitionGallery, updateGalleryFromForm } from "@/modules/galleries/gallery.service";
import { galleryRepository } from "@/modules/galleries/gallery.repository";
import { allowedGalleryTransitions } from "@/modules/galleries/gallery-workflow";
import {
  resendGalleryInvitation,
  sendInitialGalleryInvitation,
} from "@/modules/mail/mail.service";
import {
  canResendInvitation,
  canSendInitialInvitation,
} from "@/modules/mail/mail-workflow";
import { importGalleryPhotosAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function GalleryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { error } = await searchParams;
  const [gallery, clients] = await Promise.all([galleryRepository.find(id), clientRepository.list()]);
  if (!gallery) redirect("/admin/galleries");

  async function update(formData: FormData) {
    "use server";
    const admin = await requireAdmin();
    let redirectTarget = `/admin/galleries/${id}`;
    try {
      await updateGalleryFromForm(id, formData, { actorId: admin.id });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "No se pudo guardar la galeria";
      redirectTarget += `?error=${encodeURIComponent(message)}`;
    }
    redirect(redirectTarget);
  }

  async function sendInitialInvitation() {
    "use server";
    const admin = await requireAdmin();
    await sendInitialGalleryInvitation({ galleryId: id, actorId: admin.id });
    redirect(`/admin/galleries/${id}`);
  }

  async function resendInvitation() {
    "use server";
    const admin = await requireAdmin();
    await resendGalleryInvitation({ galleryId: id, actorId: admin.id });
    redirect(`/admin/galleries/${id}`);
  }

  async function archive() {
    "use server";
    const admin = await requireAdmin();
    await archiveGallery(id, { actorId: admin.id });
    redirect("/admin/galleries");
  }

  async function changeStatus(formData: FormData) {
    "use server";
    const admin = await requireAdmin();
    const next = GalleryStatus[String(formData.get("status")) as keyof typeof GalleryStatus];
    if (!next) throw new Error("Estado de galería inválido");
    await transitionGallery(id, next, { actorId: admin.id });
    redirect(`/admin/galleries/${id}`);
  }

  const selected = gallery.selections.filter((selection) => selection.selected);
  const transitions = allowedGalleryTransitions(gallery.status);
  const selectionLimitLocked =
    gallery.selectionConfirmedAt !== null ||
    ([
      GalleryStatus.SELECTION_CONFIRMED,
      GalleryStatus.EDITING,
      GalleryStatus.READY_FOR_DELIVERY,
      GalleryStatus.DELIVERED,
      GalleryStatus.ARCHIVED,
    ] as GalleryStatus[]).includes(gallery.status);

  return (
    <AdminShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">{gallery.title}</h1>
          <p className="mt-2 text-zinc-500">{gallery.client.name}</p>
        </div>
        <GalleryStatusBadge status={gallery.status} />
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-900 bg-red-950/40 p-4 text-red-300">{error}</p>
      )}

      <div className="mt-6 grid gap-4 rounded-lg border border-zinc-800 bg-[#141417] p-4 text-sm text-zinc-300">
        <p>Link privado: <Link className="text-[#d9902f]" href={`/g/${gallery.accessToken}`}>{env.APP_BASE_URL}/g/{gallery.accessToken}</Link></p>
        <p>Token: <span className="font-mono text-xs">{gallery.accessToken}</span></p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <form action={update} className="grid gap-4 rounded-lg border border-zinc-800 bg-[#141417] p-5">
          <h2 className="text-xl font-bold">Datos</h2>
          <FormField label="Cliente">
            <select name="clientId" defaultValue={gallery.clientId}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </FormField>
          <FormField label="Titulo"><input name="title" defaultValue={gallery.title} required /></FormField>
          <FormField label="Slug"><input name="slug" defaultValue={gallery.slug} /></FormField>
          <FormField label="Limite seleccion"><input name="selectionLimit" type="number" min="1" defaultValue={gallery.selectionLimit ?? ""} readOnly={selectionLimitLocked} /></FormField>
          <FormField label="Expira"><input name="expiresAt" type="date" defaultValue={gallery.expiresAt?.toISOString().slice(0, 10) ?? ""} /></FormField>
          <FormField label="Proofing local path"><input name="proofingLocalPath" defaultValue={gallery.proofingLocalPath ?? ""} /></FormField>
          <FormField label="Thumb local path"><input name="thumbnailLocalPath" defaultValue={gallery.thumbnailLocalPath ?? ""} /></FormField>
          <FormField label="Preview local path"><input name="previewLocalPath" defaultValue={gallery.previewLocalPath ?? ""} /></FormField>
          <FormField label="Google Drive carpeta"><input name="googleDriveFolderUrl" defaultValue={gallery.googleDriveFolderUrl ?? ""} /></FormField>
          <FormField label="Google Drive entrega"><input name="deliveryDriveUrl" defaultValue={gallery.deliveryDriveUrl ?? ""} /></FormField>
          <button type="submit">Guardar galeria</button>
        </form>

        <aside className="grid content-start gap-3">
          <div className="grid gap-3 rounded-lg border border-zinc-800 bg-[#141417] p-4">
            <div>
              <h2 className="font-bold">Cambiar estado</h2>
              <p className="mt-1 text-sm text-zinc-500">Estado actual: {gallery.status}</p>
            </div>
            {transitions.length > 0 ? (
              <form action={changeStatus} className="grid gap-3">
                <select name="status" required defaultValue="">
                  <option value="" disabled>Selecciona una transición</option>
                  {transitions.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <button type="submit">Aplicar transición</button>
              </form>
            ) : (
              <p className="text-sm text-zinc-500">No hay transiciones disponibles.</p>
            )}
          </div>
          {gallery.status !== GalleryStatus.ARCHIVED && (
            <form action={importGalleryPhotosAction.bind(null, id)}>
              <button className="w-full" type="submit">Importar fotos</button>
            </form>
          )}
          {canSendInitialInvitation(gallery.status) && (
            <form action={sendInitialInvitation}>
              <button className="secondary w-full" type="submit">Enviar invitación</button>
            </form>
          )}
          {canResendInvitation(gallery.status) && (
            <form action={resendInvitation}>
              <button className="secondary w-full" type="submit">Reenviar invitación</button>
            </form>
          )}
          <div className="grid gap-2">
            <a className="button secondary text-center" href={`/admin/galleries/${id}/export`}>Exportar seleccion TXT</a>
            <a className="button secondary text-center" href={`/admin/galleries/${id}/export/csv`}>Exportar seleccion CSV</a>
          </div>
          {gallery.status !== GalleryStatus.ARCHIVED && (
            <form action={archive}><button className="secondary w-full" type="submit">Archivar</button></form>
          )}
          <div className="rounded-lg border border-zinc-800 bg-[#141417] p-4">
            <h2 className="font-bold">Seleccionadas</h2>
            <p className="mt-1 text-sm text-zinc-500">{selected.length} fotos</p>
            <ul className="mt-4 grid gap-2 text-sm">
              {selected.map((selection) => (
                <li key={selection.id} className="rounded border border-zinc-800 p-2">
                  <strong>{selection.photo.baseName}</strong>
                  {selection.comment && <p className="mt-1 text-zinc-400">{selection.comment}</p>}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <GalleryPhotoManager photos={gallery.photos} />

      <section className="mt-8">
        <h2 className="text-xl font-bold">Historial</h2>
        <ul className="mt-4 grid gap-2 text-sm text-zinc-400">
          {gallery.events.map((event) => (
            <li key={event.id} className="rounded border border-zinc-800 p-2">
              <span className="font-mono text-xs text-zinc-500">{event.createdAt.toLocaleString()}</span>{" "}
              <strong className="text-zinc-200">{event.type}</strong>
              {event.metadata != null && (
                <pre className="mt-1 overflow-x-auto text-xs text-zinc-500">
                  {JSON.stringify(event.metadata, null, 2)}
                </pre>
              )}
            </li>
          ))}
          {gallery.events.length === 0 && <li className="text-zinc-500">Sin eventos todavia.</li>}
        </ul>
      </section>
    </AdminShell>
  );
}
