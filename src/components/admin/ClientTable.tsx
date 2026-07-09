import Link from "next/link";
import type { Client, Gallery } from "@prisma/client";

type ClientListItem = Client & { galleries: Pick<Gallery, "id">[] };

export function ClientTable({ clients }: { clients: ClientListItem[] }) {
  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-zinc-800">
      {clients.map((client) => (
        <Link
          key={client.id}
          href={`/admin/clients/${client.id}`}
          className="grid gap-1 border-b border-zinc-800 bg-[#141417] p-4 last:border-b-0"
        >
          <strong>{client.name}</strong>
          <span className="text-sm text-zinc-500">{client.email || "Sin email"} · {client.galleries.length} galerias</span>
        </Link>
      ))}
      {clients.length === 0 && <p className="p-4 text-zinc-500">No hay clientes todavia.</p>}
    </div>
  );
}
