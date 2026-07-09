import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
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
      <div className="mt-6 overflow-hidden rounded-lg border border-zinc-800">
        {clients.map((client) => (
          <Link key={client.id} href={`/admin/clients/${client.id}`} className="grid gap-1 border-b border-zinc-800 bg-[#141417] p-4 last:border-b-0">
            <strong>{client.name}</strong>
            <span className="text-sm text-zinc-500">{client.email || "Sin email"} · {client.galleries.length} galerias</span>
          </Link>
        ))}
        {clients.length === 0 && <p className="p-4 text-zinc-500">No hay clientes todavia.</p>}
      </div>
    </AdminShell>
  );
}
