import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { FormField } from "@/components/ui/FormField";
import { requireAdmin } from "@/lib/auth";
import { clientRepository } from "@/modules/clients/client.repository";
import { updateClientFromForm } from "@/modules/clients/client.service";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const client = await clientRepository.find(id);
  if (!client) redirect("/admin/clients");

  async function update(formData: FormData) {
    "use server";
    await requireAdmin();
    await updateClientFromForm(id, formData);
    redirect(`/admin/clients/${id}`);
  }

  return (
    <AdminShell>
      <h1 className="text-3xl font-black">{client.name}</h1>
      <form action={update} className="mt-6 grid max-w-xl gap-4">
        <FormField label="Nombre"><input name="name" defaultValue={client.name} required /></FormField>
        <FormField label="Email"><input name="email" type="email" defaultValue={client.email ?? ""} /></FormField>
        <FormField label="Telefono"><input name="phone" defaultValue={client.phone ?? ""} /></FormField>
        <FormField label="Notas"><textarea name="notes" rows={4} defaultValue={client.notes ?? ""} /></FormField>
        <button type="submit">Guardar</button>
      </form>
    </AdminShell>
  );
}
