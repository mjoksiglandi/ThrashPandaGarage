import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { ClientTable } from "@/components/admin/ClientTable";
import { requireAdmin } from "@/lib/auth";
import { clientRepository } from "@/modules/clients/client.repository";

export const dynamic = "force-dynamic";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ success?: string }> }) {
  await requireAdmin();
  const { success } = await searchParams;
  const clients = await clientRepository.list();
  return (
    <AdminShell>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-black">Clientes</h1>
        <Link className="button" href="/admin/clients/new">Nuevo cliente</Link>
      </div>
      {success === "created" && <p role="status" className="mt-4 rounded-lg border border-emerald-900 bg-emerald-950/40 p-4 text-emerald-300">Cliente creado correctamente.</p>}
      <ClientTable clients={clients} />
    </AdminShell>
  );
}
