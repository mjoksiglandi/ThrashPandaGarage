import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { FormField } from "@/components/ui/FormField";
import { clientRepository } from "@/modules/clients/client.repository";
import { createGalleryFromForm } from "@/modules/galleries/gallery.service";

export const dynamic = "force-dynamic";

export default async function NewGalleryPage() {
  const clients = await clientRepository.list();
  async function create(formData: FormData) {
    "use server";
    const gallery = await createGalleryFromForm(formData);
    redirect(`/admin/galleries/${gallery.id}`);
  }
  return (
    <AdminShell>
      <h1 className="text-3xl font-black">Nueva galeria</h1>
      <GalleryForm clients={clients} action={create} />
    </AdminShell>
  );
}

function GalleryForm({ clients, action }: { clients: { id: string; name: string }[]; action: (formData: FormData) => void }) {
  return (
    <form action={action} className="mt-6 grid max-w-2xl gap-4">
      <FormField label="Cliente"><select name="clientId" required>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></FormField>
      <FormField label="Titulo"><input name="title" required /></FormField>
      <FormField label="Slug"><input name="slug" /></FormField>
      <FormField label="Limite seleccion"><input name="selectionLimit" type="number" min="1" /></FormField>
      <FormField label="Carpeta thumbs relativa"><input name="thumbnailLocalPath" placeholder="2026-07-08_cliente/thumbs" /></FormField>
      <FormField label="Carpeta preview relativa"><input name="previewLocalPath" placeholder="2026-07-08_cliente/preview" /></FormField>
      <button type="submit">Crear galeria</button>
    </form>
  );
}
