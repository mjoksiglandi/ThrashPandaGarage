import "server-only";

import type { AccountStatus } from "@prisma/client";
import { clientRepository } from "@/modules/clients/client.repository";
import {
  createClientAccountAndInvite,
  resendClientAccountInvitation,
} from "./client-account-admin";

export const MAX_BULK_CLIENT_INVITATIONS = 25;
export const BULK_CLIENT_INVITATION_CONCURRENCY = 3;

export type BulkClientInvitationOutcome =
  | "INVITED"
  | "RESENT"
  | "SKIPPED_NO_EMAIL"
  | "SKIPPED_ACTIVE"
  | "SKIPPED_LOCKED"
  | "SKIPPED_DISABLED"
  | "FAILED";

export type BulkClientInvitationItemResult = {
  clientId: string;
  clientName: string;
  outcome: BulkClientInvitationOutcome;
  message: string;
};

export type BulkClientInvitationResult = {
  items: BulkClientInvitationItemResult[];
  invited: number;
  resent: number;
  skipped: number;
  failed: number;
};

export type BulkClientInvitationActionState =
  | { status: "idle" }
  | { status: "validation-error"; message: string }
  | ({ status: "complete" } & BulkClientInvitationResult);

export class BulkClientInvitationSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BulkClientInvitationSelectionError";
  }
}

type InvitationCandidate = {
  id: string;
  name: string;
  email: string | null;
  account: { status: AccountStatus } | null;
};

type BulkClientInvitationDependencies = {
  findClients(ids: string[]): Promise<InvitationCandidate[]>;
  createAndInvite(input: { clientId: string; actorId: string }): Promise<unknown>;
  resend(input: { clientId: string; actorId: string }): Promise<unknown>;
};

const clientIdPattern = /^[A-Za-z0-9_-]{1,64}$/;

function validateClientIds(values: readonly unknown[]): string[] {
  if (values.length === 0) {
    throw new BulkClientInvitationSelectionError("Selecciona al menos un cliente.");
  }
  if (values.length > MAX_BULK_CLIENT_INVITATIONS) {
    throw new BulkClientInvitationSelectionError(
      `Puedes invitar hasta ${MAX_BULK_CLIENT_INVITATIONS} clientes por operación.`
    );
  }
  if (values.some((value) => typeof value !== "string" || !clientIdPattern.test(value))) {
    throw new BulkClientInvitationSelectionError("La selección de clientes no es válida.");
  }

  const ids = values as string[];
  if (new Set(ids).size !== ids.length) {
    throw new BulkClientInvitationSelectionError("La selección contiene clientes duplicados.");
  }
  return ids;
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  operation: (value: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await operation(values[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker())
  );
  return results;
}

function skippedResult(candidate: InvitationCandidate): BulkClientInvitationItemResult {
  if (!candidate.account) {
    return {
      clientId: candidate.id,
      clientName: candidate.name,
      outcome: "SKIPPED_NO_EMAIL",
      message: "Omitido: el cliente no tiene correo.",
    };
  }

  const labels = {
    ACTIVE: ["SKIPPED_ACTIVE", "Omitido: la cuenta ya está activa."],
    LOCKED: ["SKIPPED_LOCKED", "Omitido: la cuenta está bloqueada."],
    DISABLED: ["SKIPPED_DISABLED", "Omitido: la cuenta está deshabilitada."],
  } as const;
  const [outcome, message] = labels[candidate.account.status as keyof typeof labels];
  return { clientId: candidate.id, clientName: candidate.name, outcome, message };
}

export function createBulkClientInvitationService(
  dependencies: BulkClientInvitationDependencies
) {
  return async function bulkInviteClients(input: {
    clientIds: readonly unknown[];
    actorId: string;
  }): Promise<BulkClientInvitationResult> {
    const clientIds = validateClientIds(input.clientIds);
    const candidates = await dependencies.findClients(clientIds);
    if (candidates.length !== clientIds.length) {
      throw new BulkClientInvitationSelectionError("La selección de clientes no es válida.");
    }

    const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    const orderedCandidates = clientIds.map((id) => byId.get(id));
    if (orderedCandidates.some((candidate) => !candidate)) {
      throw new BulkClientInvitationSelectionError("La selección de clientes no es válida.");
    }

    const items = await mapWithConcurrency(
      orderedCandidates as InvitationCandidate[],
      BULK_CLIENT_INVITATION_CONCURRENCY,
      async (candidate): Promise<BulkClientInvitationItemResult> => {
        try {
          if (!candidate.account && candidate.email) {
            await dependencies.createAndInvite({
              clientId: candidate.id,
              actorId: input.actorId,
            });
            return {
              clientId: candidate.id,
              clientName: candidate.name,
              outcome: "INVITED",
              message: "Invitación enviada.",
            };
          }
          if (candidate.account?.status === "INVITED") {
            await dependencies.resend({
              clientId: candidate.id,
              actorId: input.actorId,
            });
            return {
              clientId: candidate.id,
              clientName: candidate.name,
              outcome: "RESENT",
              message: "Invitación reenviada.",
            };
          }
          return skippedResult(candidate);
        } catch {
          return {
            clientId: candidate.id,
            clientName: candidate.name,
            outcome: "FAILED",
            message: "Falló el envío. Puedes reintentar este cliente.",
          };
        }
      }
    );

    return {
      items,
      invited: items.filter((item) => item.outcome === "INVITED").length,
      resent: items.filter((item) => item.outcome === "RESENT").length,
      skipped: items.filter((item) => item.outcome.startsWith("SKIPPED_")).length,
      failed: items.filter((item) => item.outcome === "FAILED").length,
    };
  };
}

export const bulkInviteClients = createBulkClientInvitationService({
  findClients: (ids) => clientRepository.findForBulkInvitation(ids),
  createAndInvite: createClientAccountAndInvite,
  resend: resendClientAccountInvitation,
});
