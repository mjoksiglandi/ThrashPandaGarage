import { redirect } from "next/navigation";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
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
      <h1 className="text-3xl font-black">Nuevo cliente</h1>
      {error && <p role="alert" className="mt-4 rounded-lg border border-red-900 bg-red-950/40 p-4 text-red-300">{error}</p>}
      <ClientForm action={create} />
    </AdminShell>
  );
}

function ClientForm({ action }: { action: (formData: FormData) => void }) {
  return (
    <AdminActionForm action={action} className="mt-6 grid max-w-xl gap-4" label="Crear cliente" pendingLabel="Creando…">
      <FormField label="Nombre"><input name="name" required /></FormField>
      <FormField label="Email"><input name="email" type="email" /></FormField>
      <FormField label="Teléfono"><input name="phone" /></FormField>
      <FormField label="Notas"><textarea name="notes" rows={4} /></FormField>
    </AdminActionForm>
  );
}
