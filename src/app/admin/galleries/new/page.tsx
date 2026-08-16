import { redirect } from "next/navigation";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { AdminShell } from "@/components/admin/AdminShell";
import { FormField } from "@/components/ui/FormField";
import { requireAdmin } from "@/lib/auth";
import { clientRepository } from "@/modules/clients/client.repository";
import { createGalleryFromForm } from "@/modules/galleries/gallery.service";

export const dynamic = "force-dynamic";

export default async function NewGalleryPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const { error } = await searchParams;
  const clients = await clientRepository.list();
  async function create(formData: FormData) {
    "use server";
    const admin = await requireAdmin();
    let target: string;
    try {
      const gallery = await createGalleryFromForm(formData, { actorId: admin.id });
      target = `/admin/galleries/${gallery.id}?success=created`;
    } catch {
      target = "/admin/galleries/new?error=No%20se%20pudo%20crear%20la%20galer%C3%ADa.%20Revisa%20los%20datos%20e%20int%C3%A9ntalo%20nuevamente.";
    }
    redirect(target);
  }
  return (
    <AdminShell>
      <AdminPageHeader breadcrumbs={[{ href: "/admin", label: "Admin" }, { href: "/admin/galleries", label: "Galerías" }, { label: "Nueva galería" }]} description="Crea el espacio de trabajo y define su selección inicial." title="Nueva galería" />
      {error && <p role="alert" className="admin-alert admin-alert--error">{error}</p>}
      <GalleryForm clients={clients} action={create} />
    </AdminShell>
  );
}

function GalleryForm({ clients, action }: { clients: { id: string; name: string }[]; action: (formData: FormData) => void }) {
  return (
    <AdminPanel className="admin-form-shell" description="Datos operativos de la galería" title="Información principal">
      <AdminActionForm action={action} className="admin-form admin-form-grid" label="Crear galería" pendingLabel="Creando…">
        <FormField label="Cliente"><select name="clientId" required>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></FormField>
        <FormField label="Título"><input name="title" required /></FormField>
        <FormField label="Slug"><input name="slug" /></FormField>
        <FormField label="Límite de selección"><input name="selectionLimit" type="number" min="1" /></FormField>
        <FormField label="Carpeta thumbs relativa"><input name="thumbnailLocalPath" placeholder="2026-07-08_cliente/thumbs" /></FormField>
        <FormField label="Carpeta preview relativa"><input name="previewLocalPath" placeholder="2026-07-08_cliente/preview" /></FormField>
      </AdminActionForm>
    </AdminPanel>
  );
}
