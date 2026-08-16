"use client";

import Link from "next/link";
import { AccountStatus } from "@prisma/client";
import type { Account, Client, Gallery } from "@prisma/client";
import { useActionState, useState } from "react";
import type { BulkClientInvitationActionState } from "@/modules/accounts/bulk-client-invitations";
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

const initialState: BulkClientInvitationActionState = { status: "idle" };

type ClientTableProps = {
  action: (
    state: BulkClientInvitationActionState,
    formData: FormData
  ) => Promise<BulkClientInvitationActionState>;
  clients: ClientListItem[];
};

export function BulkInvitationFeedback({ state }: { state: BulkClientInvitationActionState }) {
  if (state.status === "validation-error") {
    return (
      <p className="m-4 rounded-[6px] border border-red-900 bg-red-950/40 p-3 text-sm text-red-300" role="alert">
        {state.message}
      </p>
    );
  }
  if (state.status !== "complete") return null;

  return (
    <div className="m-4 rounded-[6px] border border-[var(--line)] bg-black/10 p-3 text-sm" role="status">
      <p className="font-medium text-[var(--foreground)]">
        {state.invited} enviada{state.invited === 1 ? "" : "s"} · {state.resent} reenviada{state.resent === 1 ? "" : "s"} · {state.skipped} omitida{state.skipped === 1 ? "" : "s"} · {state.failed} fallida{state.failed === 1 ? "" : "s"}
      </p>
      <ul className="mt-2 space-y-1 text-[var(--muted)]">
        {state.items.map((item) => <li key={item.clientId}><strong className="text-[var(--foreground)]">{item.clientName}:</strong> {item.message}</li>)}
      </ul>
    </div>
  );
}

export function ClientTable({ action, clients }: ClientTableProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [state, formAction, pending] = useActionState(action, initialState);
  const allSelected = selected.length === clients.length;
  const headers = [
    <label key="selection" className="inline-flex items-center">
      <span className="sr-only">Seleccionar todos los clientes visibles</span>
      <input
        aria-label="Seleccionar todos los clientes visibles"
        checked={allSelected}
        onChange={(event) => setSelected(event.target.checked ? clients.map((client) => client.id) : [])}
        type="checkbox"
      />
    </label>,
    "Cliente",
    "Contacto",
    "Cuenta",
    "Galerías",
    "Registro",
    "",
  ];

  return (
    <form action={formAction}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
        <p aria-live="polite" className="text-sm text-[var(--muted)]">
          {selected.length ? `${selected.length} seleccionado${selected.length === 1 ? "" : "s"}` : "Sin selección"}
        </p>
        <button className="button px-4 py-2 text-sm" disabled={pending || selected.length === 0} type="submit">
          {pending ? "Enviando invitaciones…" : "Invitar seleccionados"}
        </button>
      </div>
      <BulkInvitationFeedback state={state} />
      <AdminTable headers={headers}>
        {clients.map((client) => {
          const status = client.account?.status;
          return (
            <tr key={client.id} className="transition-colors hover:bg-white/[0.025]">
              <td>
                <input
                  aria-label={`Seleccionar a ${client.name}`}
                  checked={selected.includes(client.id)}
                  name="clientIds"
                  onChange={(event) => setSelected((current) => event.target.checked ? [...current, client.id] : current.filter((id) => id !== client.id))}
                  type="checkbox"
                  value={client.id}
                />
              </td>
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
    </form>
  );
}
