import { AccountStatus } from "@prisma/client";
import Link from "next/link";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminToolbar } from "@/components/admin/AdminToolbar";
import { ClientTable } from "@/components/admin/ClientTable";
import { requireAdmin } from "@/lib/auth";
import { clientRepository } from "@/modules/clients/client.repository";
import { filterClients } from "../admin-list-filters";
import { inviteSelectedClients } from "./actions";

export const dynamic = "force-dynamic";

type ClientSearchParams = { gallery?: string; q?: string; success?: string };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<ClientSearchParams> }) {
  await requireAdmin();
  const { gallery = "all", q = "", success } = await searchParams;
  const clients = await clientRepository.list();
  const visibleClients = filterClients(clients, q, gallery);

  const tabHref = (value: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (value !== "all") params.set("gallery", value);
    const query = params.toString();
    return query ? `/admin/clients?${query}` : "/admin/clients";
  };

  const withGalleries = clients.filter((client) => client.galleries.length > 0).length;
  const pendingInvites = clients.filter((client) => client.account?.status === AccountStatus.INVITED).length;

  return (
    <AdminShell>
      <AdminPageHeader
        actions={<Link className="button" href="/admin/clients/new">Nuevo cliente</Link>}
        breadcrumbs={[{ href: "/admin", label: "Admin" }, { label: "Clientes" }]}
        description={`${clients.length} ${clients.length === 1 ? "cliente registrado" : "clientes registrados"}${pendingInvites ? ` · ${pendingInvites} con invitación pendiente` : ""}`}
        title="Clientes"
      />
      {success === "created" && <p role="status" className="mb-4 rounded-[6px] border border-emerald-900 bg-emerald-950/40 p-4 text-sm text-emerald-300">Cliente creado correctamente.</p>}
      <nav aria-label="Filtrar clientes" className="admin-tabs mb-4">
        <Link className={gallery === "all" ? "is-active" : undefined} href={tabHref("all")}>Todos<span>{clients.length}</span></Link>
        <Link className={gallery === "with" ? "is-active" : undefined} href={tabHref("with")}>Con galerías<span>{withGalleries}</span></Link>
        <Link className={gallery === "without" ? "is-active" : undefined} href={tabHref("without")}>Sin galerías<span>{clients.length - withGalleries}</span></Link>
      </nav>
      <AdminToolbar
        placeholder="Buscar por nombre, correo o teléfono…"
        preservedParams={gallery === "all" ? undefined : { gallery }}
        query={q}
        resetHref="/admin/clients"
      />
      <AdminPanel className="overflow-hidden">
        {visibleClients.length > 0 ? <ClientTable action={inviteSelectedClients} clients={visibleClients} /> : (
          <AdminEmptyState
            actionHref={clients.length ? "/admin/clients" : "/admin/clients/new"}
            actionLabel={clients.length ? "Limpiar filtros" : "Crear primer cliente"}
            description={clients.length ? "Ajusta la búsqueda o los filtros para ver otros resultados." : "Crea un cliente para asociar galerías y habilitar su acceso."}
            title={clients.length ? "No encontramos clientes" : "Todavía no hay clientes"}
          />
        )}
      </AdminPanel>
    </AdminShell>
  );
}
