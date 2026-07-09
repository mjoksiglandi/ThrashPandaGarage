import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { ClientTable } from "@/components/admin/ClientTable";
import { clientRepository } from "@/modules/clients/client.repository";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const clients = await clientRepository.list();
  return (
    <AdminShell>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-black">Clientes</h1>
        <Link className="button" href="/admin/clients/new">Nuevo cliente</Link>
      </div>
      <ClientTable clients={clients} />
    </AdminShell>
  );
}
