import Link from "next/link";
import type { Client, Gallery } from "@prisma/client";
import { AdminStatusChip } from "./AdminStatusChip";
import { AdminTable } from "./AdminTable";

type ClientListItem = Client & { galleries: Pick<Gallery, "id">[] };

export function ClientTable({ clients }: { clients: ClientListItem[] }) {
  return (
    <AdminTable headers={["Cliente", "Contacto", "Galerías", "Registro", ""]}>
      {clients.map((client) => (
        <tr key={client.id} className="transition-colors hover:bg-white/[0.025]">
          <td className="px-5 py-4"><Link className="font-medium text-[var(--foreground)] hover:text-[var(--accent)]" href={`/admin/clients/${client.id}`}>{client.name}</Link></td>
          <td className="px-5 py-4"><p className="text-[var(--muted)]">{client.email || "Sin correo"}</p><p className="mt-0.5 text-xs text-[var(--muted-2)]">{client.phone || "Sin teléfono"}</p></td>
          <td className="px-5 py-4"><AdminStatusChip tone={client.galleries.length ? "violet" : "neutral"}>{client.galleries.length} {client.galleries.length === 1 ? "galería" : "galerías"}</AdminStatusChip></td>
          <td className="px-5 py-4 font-mono text-[10px] text-[var(--muted-2)]">{client.createdAt.toLocaleDateString("es-CL")}</td>
          <td className="px-5 py-4 text-right"><Link className="secondary inline-flex px-3 py-1.5 text-xs" href={`/admin/clients/${client.id}`}>Ver</Link></td>
        </tr>
      ))}
    </AdminTable>
  );
}
