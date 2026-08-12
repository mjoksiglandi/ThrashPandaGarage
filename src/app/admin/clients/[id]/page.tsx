import { AccountStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { AdminShell } from "@/components/admin/AdminShell";
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
      <h1 className="text-3xl font-black">{client.name}</h1>
      {message.error && (
        <p role="alert" className="mt-4 rounded-lg border border-red-900 bg-red-950/40 p-4 text-red-300">
          {message.error}
        </p>
      )}
      {message.success && (
        <p role="status" className="mt-4 rounded-lg border border-emerald-900 bg-emerald-950/40 p-4 text-emerald-300">
          {message.success === "saved"
            ? "Cliente guardado correctamente."
            : message.success === "resent"
            ? "Invitación reenviada."
            : "Cuenta creada e invitación enviada."}
        </p>
      )}
      <AdminActionForm action={update} className="mt-6 grid max-w-xl gap-4" label="Guardar" pendingLabel="Guardando…">
        <FormField label="Nombre"><input name="name" defaultValue={client.name} required /></FormField>
        <FormField label="Email"><input name="email" type="email" defaultValue={client.email ?? ""} /></FormField>
        <FormField label="Telefono"><input name="phone" defaultValue={client.phone ?? ""} /></FormField>
        <FormField label="Notas"><textarea name="notes" rows={4} defaultValue={client.notes ?? ""} /></FormField>
      </AdminActionForm>

      <section className="mt-10 max-w-xl rounded-lg border border-zinc-800 bg-[#141417] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Cuenta</h2>
            <p className="mt-1 text-sm text-zinc-400">
              {account ? accountStatusLabels[account.status] : "Sin cuenta"}
            </p>
          </div>
          <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">
            {account ? accountStatusLabels[account.status] : "Sin cuenta"}
          </span>
        </div>

        {account ? (
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">Correo asociado</dt>
              <dd className="mt-1 break-all text-zinc-200">{account.email}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Fecha de invitación</dt>
              <dd className="mt-1 text-zinc-200">{formatDate(latestInvitation?.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Activación</dt>
              <dd className="mt-1 text-zinc-200">{formatDate(activation)}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-5 text-sm text-zinc-400">
            {client.email
              ? `La invitación se enviará a ${client.email}.`
              : "Guarda primero un correo válido para habilitar la invitación."}
          </p>
        )}

        {!account && (
          <AdminActionForm action={createAccount} className="mt-5" disabled={!client.email} label="Crear cuenta e invitar" pendingLabel="Creando y enviando…" />
        )}
        {account?.status === AccountStatus.INVITED && (
          <AdminActionForm action={resendInvitation} className="mt-5" buttonClassName="secondary" label="Reenviar invitación" pendingLabel="Reenviando…" />
        )}
      </section>
    </AdminShell>
  );
}
