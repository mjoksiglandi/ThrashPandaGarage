import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { FormField } from "@/components/ui/FormField";
import { requireAdmin } from "@/lib/auth";
import { createClientFromForm } from "@/modules/clients/client.service";

export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  await requireAdmin();

  async function create(formData: FormData) {
    "use server";
    await requireAdmin();
    await createClientFromForm(formData);
    redirect("/admin/clients");
  }

  return (
    <AdminShell>
      <h1 className="text-3xl font-black">Nuevo cliente</h1>
      <ClientForm action={create} />
    </AdminShell>
  );
}

function ClientForm({ action }: { action: (formData: FormData) => void }) {
  return (
    <form action={action} className="mt-6 grid max-w-xl gap-4">
      <FormField label="Nombre"><input name="name" required /></FormField>
      <FormField label="Email"><input name="email" type="email" /></FormField>
      <FormField label="Contraseña del portal (mínimo 8 caracteres)"><input name="password" type="password" minLength={8} autoComplete="new-password" /></FormField>
      <FormField label="Telefono"><input name="phone" /></FormField>
      <FormField label="Notas"><textarea name="notes" rows={4} /></FormField>
      <button type="submit">Crear cliente</button>
    </form>
  );
}
