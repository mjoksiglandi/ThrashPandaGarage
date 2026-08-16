import { redirect } from "next/navigation";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { AdminShell } from "@/components/admin/AdminShell";
import { FormField } from "@/components/ui/FormField";
import { requireAdmin } from "@/lib/auth";
import { createClientFromForm } from "@/modules/clients/client.service";

export const dynamic = "force-dynamic";

export default async function NewClientPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const { error } = await searchParams;

  async function create(formData: FormData) {
    "use server";
    await requireAdmin();
    let target = "/admin/clients?success=created";
    try {
      await createClientFromForm(formData);
    } catch {
      target = "/admin/clients/new?error=No%20se%20pudo%20crear%20el%20cliente.%20Revisa%20los%20datos%20e%20int%C3%A9ntalo%20nuevamente.";
    }
    redirect(target);
  }

  return (
    <AdminShell>
      <AdminPageHeader breadcrumbs={[{ href: "/admin", label: "Admin" }, { href: "/admin/clients", label: "Clientes" }, { label: "Nuevo cliente" }]} description="Registra los datos esenciales del cliente. El acceso al portal se habilita después." title="Nuevo cliente" />
      {error && <p role="alert" className="admin-alert admin-alert--error">{error}</p>}
      <ClientForm action={create} />
    </AdminShell>
  );
}

function ClientForm({ action }: { action: (formData: FormData) => void }) {
  return (
    <AdminPanel className="admin-form-shell" description="Datos de contacto del cliente" title="Información principal">
      <AdminActionForm action={action} className="admin-form admin-form-grid" label="Crear cliente" pendingLabel="Creando…">
        <FormField label="Nombre"><input name="name" required /></FormField>
        <FormField label="Email"><input name="email" type="email" /></FormField>
        <FormField label="Teléfono"><input name="phone" /></FormField>
        <FormField label="Notas"><textarea name="notes" rows={4} /></FormField>
      </AdminActionForm>
    </AdminPanel>
  );
}
