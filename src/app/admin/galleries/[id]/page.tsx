import { GalleryStatus } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { GalleryStatusBadge } from "@/components/admin/GalleryStatusBadge";
import { GalleryPhotoManager } from "@/components/admin/GalleryPhotoManager";
import { SelectedPhotoList } from "@/components/admin/SelectedPhotoList";
import { SendGalleryEmailButton } from "@/components/admin/SendGalleryEmailButton";
import { ExportSelectionButton } from "@/components/admin/ExportSelectionButton";
import { FormField } from "@/components/ui/FormField";
import { env } from "@/lib/env";
import { clientRepository } from "@/modules/clients/client.repository";
import { archiveGallery, updateGalleryFromForm } from "@/modules/galleries/gallery.service";
import { galleryRepository } from "@/modules/galleries/gallery.repository";
import { importGalleryPhotos } from "@/modules/photos/photo-import.service";
import { sendGalleryEmail } from "@/modules/mail/mail.service";

export const dynamic = "force-dynamic";

export default async function GalleryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const [gallery, clients] = await Promise.all([galleryRepository.find(id), clientRepository.list()]);
  if (!gallery) redirect("/admin/galleries");

  async function update(formData: FormData) {
    "use server";
    let redirectTarget = `/admin/galleries/${id}`;
    try {
      await updateGalleryFromForm(id, formData);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "No se pudo guardar la galeria";
      redirectTarget += `?error=${encodeURIComponent(message)}`;
    }
    redirect(redirectTarget);
  }

  async function importPhotos() {
    "use server";
    await importGalleryPhotos(id);
    redirect(`/admin/galleries/${id}`);
  }

  async function sendEmail() {
    "use server";
    await sendGalleryEmail(id);
    redirect(`/admin/galleries/${id}`);
  }

  async function archive() {
    "use server";
    await archiveGallery(id);
    redirect("/admin/galleries");
  }

  const selected = gallery.selections.filter((selection) => selection.selected);

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
          <FormField label="Estado">
            <select name="status" defaultValue={gallery.status}>{Object.values(GalleryStatus).map((status) => <option key={status} value={status}>{status}</option>)}</select>
          </FormField>
          <FormField label="Limite seleccion"><input name="selectionLimit" type="number" min="1" defaultValue={gallery.selectionLimit ?? ""} /></FormField>
          <FormField label="Expira"><input name="expiresAt" type="date" defaultValue={gallery.expiresAt?.toISOString().slice(0, 10) ?? ""} /></FormField>
          <FormField label="Proofing local path"><input name="proofingLocalPath" defaultValue={gallery.proofingLocalPath ?? ""} /></FormField>
          <FormField label="Thumb local path"><input name="thumbnailLocalPath" defaultValue={gallery.thumbnailLocalPath ?? ""} /></FormField>
          <FormField label="Preview local path"><input name="previewLocalPath" defaultValue={gallery.previewLocalPath ?? ""} /></FormField>
          <FormField label="Google Drive carpeta"><input name="googleDriveFolderUrl" defaultValue={gallery.googleDriveFolderUrl ?? ""} /></FormField>
          <FormField label="Google Drive entrega"><input name="deliveryDriveUrl" defaultValue={gallery.deliveryDriveUrl ?? ""} /></FormField>
          <button type="submit">Guardar galeria</button>
        </form>

        <aside className="grid content-start gap-3">
          <form action={importPhotos}><button className="w-full" type="submit">Importar fotos</button></form>
          <SendGalleryEmailButton onSend={sendEmail} />
          <ExportSelectionButton galleryId={id} />
          <form action={archive}><button className="secondary w-full" type="submit">Archivar</button></form>
          <SelectedPhotoList selections={selected} />
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
