import Link from "next/link";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminToolbar } from "@/components/admin/AdminToolbar";
import { ClientTable } from "@/components/admin/ClientTable";
import { requireAdmin } from "@/lib/auth";
import { clientRepository } from "@/modules/clients/client.repository";

export const dynamic = "force-dynamic";

type ClientSearchParams = { gallery?: string; q?: string; success?: string };

export function filterClients<
  T extends { email: string | null; galleries: unknown[]; name: string; phone: string | null }
>(clients: T[], q: string, gallery: string) {
  const normalizedQuery = q.trim().toLocaleLowerCase("es");
  return clients.filter((client) => {
    const matchesQuery = !normalizedQuery || [client.name, client.email, client.phone]
      .some((value) => value?.toLocaleLowerCase("es").includes(normalizedQuery));
    const matchesGallery = gallery === "with" ? client.galleries.length > 0 : gallery === "without" ? client.galleries.length === 0 : true;
    return matchesQuery && matchesGallery;
  });
}

export default async function ClientsPage({ searchParams }: { searchParams: Promise<ClientSearchParams> }) {
  await requireAdmin();
  const { gallery = "all", q = "", success } = await searchParams;
  const clients = await clientRepository.list();
  const visibleClients = filterClients(clients, q, gallery);

  return (
    <AdminShell>
      <AdminPageHeader
        actions={<Link className="button" href="/admin/clients/new">Nuevo cliente</Link>}
        breadcrumbs={[{ href: "/admin", label: "Admin" }, { label: "Clientes" }]}
        description={`${clients.length} ${clients.length === 1 ? "cliente registrado" : "clientes registrados"}`}
        eyebrow="Directorio"
        title="Clientes"
      />
      {success === "created" && <p role="status" className="mb-4 rounded-[6px] border border-emerald-900 bg-emerald-950/40 p-4 text-sm text-emerald-300">Cliente creado correctamente.</p>}
      <AdminPanel className="overflow-hidden">
        <AdminToolbar placeholder="Buscar por nombre, correo o teléfono…" query={q} resetHref="/admin/clients">
          <select className="!w-full !rounded-[5px] !border !border-[var(--line)] !bg-black/10 !px-3 !py-2.5 text-sm md:!w-48" defaultValue={gallery} name="gallery">
            <option value="all">Todas las galerías</option>
            <option value="with">Con galerías</option>
            <option value="without">Sin galerías</option>
          </select>
        </AdminToolbar>
        {visibleClients.length > 0 ? <ClientTable clients={visibleClients} /> : (
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
