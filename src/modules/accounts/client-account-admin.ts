import "server-only";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sendAccountInvitationEmail } from "@/modules/mail/account-invitation-mail";
import { createInvitationService } from "@/modules/invitations/invitation.service";
import {
  cryptoTokenGenerator,
  sha256TokenHasher,
} from "./secure-token";
import { createPrismaAccountServiceStore } from "./account-service.repository";
import { normalizeAccountEmail } from "./account-email";

export const ACCOUNT_INVITATION_DURATION_DAYS = 7;
const invitationDurationMs =
  ACCOUNT_INVITATION_DURATION_DAYS * 24 * 60 * 60 * 1000;

export class ClientNotFoundError extends Error {
  constructor() {
    super("Client not found");
    this.name = "ClientNotFoundError";
  }
}

export class ClientAccountEmailRequiredError extends Error {
  constructor() {
    super("Client email is required to create an account");
    this.name = "ClientAccountEmailRequiredError";
  }
}

export class ClientAccountAlreadyExistsError extends Error {
  constructor() {
    super("Client already has an account");
    this.name = "ClientAccountAlreadyExistsError";
  }
}

export class ClientAccountEmailAlreadyUsedError extends Error {
  constructor() {
    super("Client email is already linked to another account");
    this.name = "ClientAccountEmailAlreadyUsedError";
  }
}

const invitationService = createInvitationService({
  store: createPrismaAccountServiceStore(),
  clock: { now: () => new Date() },
  tokenGenerator: cryptoTokenGenerator,
  tokenHasher: sha256TokenHasher,
  passwordHasher: {
    hash: (password) => bcrypt.hash(password, 12),
    verify: (password, passwordHash) => bcrypt.compare(password, passwordHash),
  },
  invitationDurationMs,
});

async function issueAndSendInvitation(input: {
  accountId: string;
  email: string;
  actorId: string;
}) {
  const invitation = await invitationService.issue({
    accountId: input.accountId,
    createdByActorId: input.actorId,
  });
  await sendAccountInvitationEmail({
    to: input.email,
    token: invitation.token,
    expiresInDays: ACCOUNT_INVITATION_DURATION_DAYS,
  });
  return invitation;
}

export async function createClientAccountAndInvite(input: {
  clientId: string;
  actorId: string;
}) {
  let account: { id: string; email: string };
  try {
    account = await db.$transaction(async (transaction) => {
      const client = await transaction.client.findUnique({
        where: { id: input.clientId },
        select: { email: true, account: { select: { id: true } } },
      });
      if (!client) throw new ClientNotFoundError();
      if (client.account) throw new ClientAccountAlreadyExistsError();
      if (!client.email) throw new ClientAccountEmailRequiredError();
      const email = normalizeAccountEmail(client.email);
      const existingEmail = await transaction.account.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existingEmail) throw new ClientAccountEmailAlreadyUsedError();

      return transaction.account.create({
        data: {
          clientId: input.clientId,
          email,
          status: "INVITED",
        },
        select: { id: true, email: true },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = error.meta?.target;
      if (Array.isArray(target) && target.includes("email")) {
        throw new ClientAccountEmailAlreadyUsedError();
      }
      throw new ClientAccountAlreadyExistsError();
    }
    throw error;
  }

  return issueAndSendInvitation({
    accountId: account.id,
    email: account.email,
    actorId: input.actorId,
  });
}

export async function resendClientAccountInvitation(input: {
  clientId: string;
  actorId: string;
}) {
  const client = await db.client.findUnique({
    where: { id: input.clientId },
    select: { account: { select: { id: true, email: true } } },
  });
  if (!client) throw new ClientNotFoundError();
  if (!client.account) throw new ClientAccountEmailRequiredError();

  return issueAndSendInvitation({
    accountId: client.account.id,
    email: client.account.email,
    actorId: input.actorId,
  });
}
