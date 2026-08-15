import Link from "next/link";
import { AccountStatus } from "@prisma/client";
import type { Account, Client, Gallery } from "@prisma/client";
import { AdminStatusChip, type AdminStatusTone } from "./AdminStatusChip";
import { AdminTable } from "./AdminTable";

type ClientListItem = Client & {
  galleries: Pick<Gallery, "id">[];
  account: Pick<Account, "status"> | null;
};

const accountLabels: Record<AccountStatus, string> = {
  INVITED: "Invitación pendiente",
  ACTIVE: "Cuenta activa",
  LOCKED: "Bloqueada",
  DISABLED: "Deshabilitada",
};

const accountTones: Record<AccountStatus, AdminStatusTone> = {
  INVITED: "amber",
  ACTIVE: "green",
  LOCKED: "red",
  DISABLED: "neutral",
};

export function ClientTable({ clients }: { clients: ClientListItem[] }) {
  const headers = [
    "Cliente",
    "Contacto",
    "Cuenta",
    "Galerías",
    "Registro",
    "",
  ];

  return (
    <AdminTable headers={headers}>
        {clients.map((client) => {
          const status = client.account?.status;
          return (
            <tr key={client.id} className="transition-colors hover:bg-white/[0.025]">
              <td>
                <div className="admin-cell-media">
                  <span className="admin-avatar">{client.name.slice(0, 1).toUpperCase()}</span>
                  <Link className="min-w-0 truncate font-medium text-[var(--foreground)] hover:text-[var(--accent)]" href={`/admin/clients/${client.id}`}>{client.name}</Link>
                </div>
              </td>
              <td>
                <p className="text-[var(--muted)]">{client.email || "Sin correo"}</p>
                <p className="mt-0.5 text-xs text-[var(--muted-2)]">{client.phone || "Sin teléfono"}</p>
              </td>
              <td>
                {status ? (
                  <AdminStatusChip tone={accountTones[status]}>{accountLabels[status]}</AdminStatusChip>
                ) : (
                  <AdminStatusChip tone="neutral">Sin acceso</AdminStatusChip>
                )}
              </td>
              <td>
                <AdminStatusChip tone={client.galleries.length ? "violet" : "neutral"}>
                  {client.galleries.length} {client.galleries.length === 1 ? "galería" : "galerías"}
                </AdminStatusChip>
              </td>
              <td className="font-mono text-[10px] text-[var(--muted-2)]">{client.createdAt.toLocaleDateString("es-CL")}</td>
              <td className="text-right"><Link className="secondary inline-flex px-3 py-1.5 text-xs" href={`/admin/clients/${client.id}`}>Ver</Link></td>
            </tr>
          );
        })}
    </AdminTable>
  );
}
