import { AccountStatus } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminStatusChip } from "@/components/admin/AdminStatusChip";
import { GalleryStatusBadge } from "@/components/admin/GalleryStatusBadge";
import { FormField } from "@/components/ui/FormField";
import { requireAdmin } from "@/lib/auth";
import {
  ClientAccountAlreadyExistsError,
  ClientAccountEmailAlreadyUsedError,
  ClientAccountEmailRequiredError,
  createClientAccountAndInvite,
  resendClientAccountInvitation,
} from "@/modules/accounts/client-account-admin";
import { clientRepository } from "@/modules/clients/client.repository";
import { updateClientFromForm } from "@/modules/clients/client.service";

export const dynamic = "force-dynamic";

const accountStatusLabels = {
  [AccountStatus.INVITED]: "Invitación pendiente",
  [AccountStatus.ACTIVE]: "Cuenta activa",
  [AccountStatus.LOCKED]: "Cuenta bloqueada",
  [AccountStatus.DISABLED]: "Cuenta deshabilitada",
} as const;

function formatDate(value: Date | null | undefined) {
  return value?.toLocaleString("es-CL") ?? "—";
}

function accountActionError(error: unknown) {
  if (error instanceof ClientAccountEmailRequiredError) {
    return "Agrega un correo válido al cliente antes de crear su cuenta.";
  }
  if (error instanceof ClientAccountAlreadyExistsError) {
    return "Este cliente ya tiene una cuenta asociada.";
  }
  if (error instanceof ClientAccountEmailAlreadyUsedError) {
    return "Este correo ya está asociado a otra cuenta.";
  }
  return "No se pudo enviar la invitación. Revisa la configuración de correo e inténtalo nuevamente.";
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const message = await searchParams;
  const client = await clientRepository.find(id);
  if (!client) redirect("/admin/clients");

  async function update(formData: FormData) {
    "use server";
    await requireAdmin();
    let target = `/admin/clients/${id}?success=saved`;
    try {
      await updateClientFromForm(id, formData);
    } catch {
      target = `/admin/clients/${id}?error=${encodeURIComponent("No se pudo guardar el cliente. Revisa los datos e inténtalo nuevamente.")}`;
    }
    redirect(target);
  }

  async function createAccount() {
    "use server";
    const admin = await requireAdmin();
    let target = `/admin/clients/${id}?success=invited`;
    try {
      await createClientAccountAndInvite({ clientId: id, actorId: admin.id });
    } catch (error) {
      target = `/admin/clients/${id}?error=${encodeURIComponent(accountActionError(error))}`;
    }
    redirect(target);
  }

  async function resendInvitation() {
    "use server";
    const admin = await requireAdmin();
    let target = `/admin/clients/${id}?success=resent`;
    try {
      await resendClientAccountInvitation({ clientId: id, actorId: admin.id });
    } catch (error) {
      target = `/admin/clients/${id}?error=${encodeURIComponent(accountActionError(error))}`;
    }
    redirect(target);
  }

  const account = client.account;
  const latestInvitation = account?.invitations[0];
  const activation = account?.invitations.find(
    (invitation) => invitation.acceptedAt !== null
  )?.acceptedAt;

  return (
    <AdminShell>
      <AdminPageHeader
        actions={<Link className="button" href="/admin/galleries/new">+ Nueva galería</Link>}
        breadcrumbs={[{ href: "/admin", label: "Admin" }, { href: "/admin/clients", label: "Clientes" }, { label: client.name }]}
        description={`${client.email ?? "Sin correo"}${client.phone ? ` · ${client.phone}` : ""} · ${client.galleries.length} ${client.galleries.length === 1 ? "galería" : "galerías"}`}
        media={<span className="admin-client-hero-avatar">{client.name.slice(0, 1).toUpperCase()}</span>}
        status={<AdminStatusChip tone={account?.status === AccountStatus.ACTIVE ? "green" : account?.status === AccountStatus.INVITED ? "amber" : account ? "red" : "neutral"}>{account ? accountStatusLabels[account.status] : "Sin acceso"}</AdminStatusChip>}
        title={client.name}
      />
      {message.error && (
        <p role="alert" className="admin-alert admin-alert--error">
          {message.error}
        </p>
      )}
      {message.success && (
        <p role="status" className="admin-alert admin-alert--success">
          {message.success === "saved"
            ? "Cliente guardado correctamente."
            : message.success === "resent"
            ? "Invitación reenviada."
            : "Cuenta creada e invitación enviada."}
        </p>
      )}
      <div className="admin-detail-grid">
        <div className="grid content-start gap-5">
          <AdminPanel title="Información de contacto">
            <AdminActionForm action={update} className="admin-form admin-form-grid" label="Guardar cambios" pendingLabel="Guardando…">
              <FormField label="Nombre"><input name="name" defaultValue={client.name} required /></FormField>
              <FormField label="Email"><input name="email" type="email" defaultValue={client.email ?? ""} /></FormField>
              <FormField label="Teléfono"><input name="phone" defaultValue={client.phone ?? ""} /></FormField>
              <FormField label="Notas"><textarea name="notes" rows={4} defaultValue={client.notes ?? ""} /></FormField>
            </AdminActionForm>
          </AdminPanel>
          <AdminPanel actions={<Link className="admin-panel-link" href="/admin/galleries">Ver todas →</Link>} title="Galerías recientes">
            {client.galleries.length ? (
              <ul className="admin-related-list">
                {client.galleries.slice(0, 5).map((gallery) => (
                  <li key={gallery.id}>
                    <Link href={`/admin/galleries/${gallery.id}`}>{gallery.title}</Link>
                    <GalleryStatusBadge status={gallery.status} />
                    <time>{gallery.createdAt.toLocaleDateString("es-CL")}</time>
                  </li>
                ))}
              </ul>
            ) : <p className="admin-list-summary">Este cliente todavía no tiene galerías.</p>}
          </AdminPanel>
        </div>

        <aside className="grid content-start gap-5">
          <AdminPanel title="Estado de cuenta">
            <dl className="admin-key-values">
              <div><dt>Acceso</dt><dd>{account ? accountStatusLabels[account.status] : "Sin cuenta"}</dd></div>
              <div><dt>Correo asociado</dt><dd>{account?.email ?? client.email ?? "—"}</dd></div>
              <div><dt>Fecha de invitación</dt><dd>{formatDate(latestInvitation?.createdAt)}</dd></div>
              <div><dt>Activación</dt><dd>{formatDate(activation)}</dd></div>
            </dl>
            <div className="admin-panel-actions">
              {!account && <AdminActionForm action={createAccount} disabled={!client.email} label="Crear cuenta e invitar" pendingLabel="Creando y enviando…" />}
              {account?.status === AccountStatus.INVITED && <AdminActionForm action={resendInvitation} buttonClassName="secondary" label="Reenviar invitación" pendingLabel="Reenviando…" />}
            </div>
          </AdminPanel>
          <AdminPanel title="Próximas acciones">
            <div className="admin-next-actions">
              <Link href="/admin/galleries/new"><span>＋</span>Crear una nueva galería</Link>
              {!account && <span><i>!</i>{client.email ? "Invitación pendiente de envío" : "Falta un correo de acceso"}</span>}
            </div>
          </AdminPanel>
        </aside>
      </div>
    </AdminShell>
  );
}
