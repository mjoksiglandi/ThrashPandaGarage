import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import type { TokenHash } from "@/lib/token-hash";
import type { NormalizedAccountEmail } from "./account-email";
import type { AccountStatusValue } from "./account.types";

export type AccountRecord = {
  id: string;
  email: string;
  status: AccountStatusValue;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
};

export type AuthenticationAccountRecord = AccountRecord & {
  passwordHash: string | null;
};

export type InvitationRecord = {
  id: string;
  accountId: string;
  tokenHash: TokenHash;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export type InvitationWithAccountRecord = InvitationRecord & {
  account: AccountRecord;
};

export type AccountSessionRecord = {
  id: string;
  accountId: string;
  tokenHash: TokenHash;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
};

export type AccountSessionWithAccountRecord = AccountSessionRecord & {
  account: AccountRecord & {
    clientId: string;
  };
};

export type AccountUpdate = {
  passwordHash?: string;
  status?: AccountStatusValue;
  failedLoginAttempts?: number;
  lockedUntil?: Date | null;
  lastLoginAt?: Date | null;
};

export interface AccountServiceTransaction {
  lockAccountById(id: string): Promise<AccountRecord | null>;
  lockAuthenticationAccountById(
    id: string
  ): Promise<AuthenticationAccountRecord | null>;
  lockAccountByEmail(email: string): Promise<AccountRecord | null>;
  lockInvitationByTokenHash(
    tokenHash: TokenHash
  ): Promise<InvitationWithAccountRecord | null>;
  lockSessionByTokenHash(
    tokenHash: TokenHash
  ): Promise<AccountSessionWithAccountRecord | null>;
  revokePendingInvitations(
    accountId: string,
    revokedAt: Date,
    exceptInvitationId?: string
  ): Promise<number>;
  createInvitation(input: {
    accountId: string;
    tokenHash: TokenHash;
    expiresAt: Date;
    createdAt: Date;
    createdByActorId: string;
  }): Promise<InvitationRecord>;
  acceptInvitation(id: string, acceptedAt: Date): Promise<void>;
  updateAccount(id: string, update: AccountUpdate): Promise<AccountRecord>;
  createSession(input: {
    accountId: string;
    tokenHash: TokenHash;
    expiresAt: Date;
    createdAt: Date;
  }): Promise<AccountSessionRecord>;
  revokeSession(id: string, revokedAt: Date): Promise<void>;
  revokeAllSessions(accountId: string, revokedAt: Date): Promise<number>;
}

export interface AccountServiceStore {
  findAuthenticationAccountByEmail(
    email: NormalizedAccountEmail
  ): Promise<AuthenticationAccountRecord | null>;
  transaction<T>(
    work: (transaction: AccountServiceTransaction) => Promise<T>
  ): Promise<T>;
}

type SessionAccountRecord = AccountRecord & { clientId: string };

function mapAccount(row: {
  id: string;
  email: string;
  status: AccountStatusValue;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
}): AccountRecord {
  return {
    id: row.id,
    email: row.email,
    status: row.status,
    failedLoginAttempts: row.failedLoginAttempts,
    lockedUntil: row.lockedUntil,
    lastLoginAt: row.lastLoginAt,
  };
}

function mapAuthenticationAccount(row: {
  id: string;
  email: string;
  passwordHash: string | null;
  status: AccountStatusValue;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
}): AuthenticationAccountRecord {
  return {
    ...mapAccount(row),
    passwordHash: row.passwordHash,
  };
}

function mapInvitationWithAccount(
  invitation: InvitationRecord,
  account: AccountRecord
): InvitationWithAccountRecord {
  return {
    ...invitation,
    account,
  };
}

function mapSessionWithAccount(
  session: AccountSessionRecord,
  account: SessionAccountRecord
): AccountSessionWithAccountRecord {
  return {
    ...session,
    account,
  };
}

export class PrismaAccountServiceTransaction implements AccountServiceTransaction {
  constructor(private readonly client: Prisma.TransactionClient) {}

  async lockAccountById(id: string): Promise<AccountRecord | null> {
    const rows = await this.client.$queryRaw<AccountRecord[]>`
      SELECT
        id,
        email,
        status,
        "failedLoginAttempts",
        "lockedUntil",
        "lastLoginAt"
      FROM "Account"
      WHERE id = ${id}
      FOR UPDATE
    `;
    return rows[0] ?? null;
  }

  async lockAuthenticationAccountById(
    id: string
  ): Promise<AuthenticationAccountRecord | null> {
    const rows = await this.client.$queryRaw<AuthenticationAccountRecord[]>`
      SELECT
        id,
        email,
        "passwordHash",
        status,
        "failedLoginAttempts",
        "lockedUntil",
        "lastLoginAt"
      FROM "Account"
      WHERE id = ${id}
      FOR UPDATE
    `;
    return rows[0] ? mapAuthenticationAccount(rows[0]) : null;
  }

  async lockAccountByEmail(email: string): Promise<AccountRecord | null> {
    const rows = await this.client.$queryRaw<AccountRecord[]>`
      SELECT
        id,
        email,
        status,
        "failedLoginAttempts",
        "lockedUntil",
        "lastLoginAt"
      FROM "Account"
      WHERE email = ${email}
      FOR UPDATE
    `;
    return rows[0] ?? null;
  }

  async lockInvitationByTokenHash(
    tokenHash: TokenHash
  ): Promise<InvitationWithAccountRecord | null> {
    const candidate = await this.client.invitation.findUnique({
      where: { tokenHash },
      select: { accountId: true },
    });
    if (!candidate) {
      return null;
    }

    // Global identity lock order: Account, then its child row.
    const account = await this.lockAccountById(candidate.accountId);
    if (!account) {
      return null;
    }

    const invitations = await this.client.$queryRaw<InvitationRecord[]>`
      SELECT
        id,
        "accountId",
        "tokenHash",
        "expiresAt",
        "acceptedAt",
        "revokedAt",
        "createdAt"
      FROM "Invitation"
      WHERE "tokenHash" = ${tokenHash}
        AND "accountId" = ${candidate.accountId}
      FOR UPDATE
    `;
    return invitations[0]
      ? mapInvitationWithAccount(invitations[0], account)
      : null;
  }

  async lockSessionByTokenHash(
    tokenHash: TokenHash
  ): Promise<AccountSessionWithAccountRecord | null> {
    const candidate = await this.client.accountSession.findUnique({
      where: { tokenHash },
      select: { accountId: true },
    });
    if (!candidate) {
      return null;
    }

    // Global identity lock order: Account, then its child row.
    const accounts = await this.client.$queryRaw<SessionAccountRecord[]>`
      SELECT
        id,
        "clientId",
        email,
        status,
        "failedLoginAttempts",
        "lockedUntil",
        "lastLoginAt"
      FROM "Account"
      WHERE id = ${candidate.accountId}
      FOR UPDATE
    `;
    const account = accounts[0];
    if (!account) {
      return null;
    }

    const sessions = await this.client.$queryRaw<AccountSessionRecord[]>`
      SELECT
        id,
        "accountId",
        "tokenHash",
        "expiresAt",
        "revokedAt",
        "createdAt"
      FROM "AccountSession"
      WHERE "tokenHash" = ${tokenHash}
        AND "accountId" = ${candidate.accountId}
      FOR UPDATE
    `;
    return sessions[0]
      ? mapSessionWithAccount(sessions[0], account)
      : null;
  }

  async revokePendingInvitations(
    accountId: string,
    revokedAt: Date,
    exceptInvitationId?: string
  ): Promise<number> {
    const result = await this.client.invitation.updateMany({
      where: {
        accountId,
        acceptedAt: null,
        revokedAt: null,
        ...(exceptInvitationId ? { id: { not: exceptInvitationId } } : {}),
      },
      data: { revokedAt },
    });
    return result.count;
  }

  async createInvitation(input: {
    accountId: string;
    tokenHash: TokenHash;
    expiresAt: Date;
    createdAt: Date;
    createdByActorId: string;
  }): Promise<InvitationRecord> {
    const invitation = await this.client.invitation.create({ data: input });
    return {
      ...invitation,
      tokenHash: invitation.tokenHash as TokenHash,
    };
  }

  async acceptInvitation(id: string, acceptedAt: Date): Promise<void> {
    await this.client.invitation.update({
      where: { id },
      data: { acceptedAt },
    });
  }

  async updateAccount(
    id: string,
    update: AccountUpdate
  ): Promise<AccountRecord> {
    const updated = await this.client.account.update({
      where: { id },
      data: update,
    });
    return mapAccount(updated);
  }

  async createSession(input: {
    accountId: string;
    tokenHash: TokenHash;
    expiresAt: Date;
    createdAt: Date;
  }): Promise<AccountSessionRecord> {
    const session = await this.client.accountSession.create({
      data: input,
    });
    return {
      ...session,
      tokenHash: session.tokenHash as TokenHash,
    };
  }

  async revokeSession(id: string, revokedAt: Date): Promise<void> {
    await this.client.accountSession.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt },
    });
  }

  async revokeAllSessions(
    accountId: string,
    revokedAt: Date
  ): Promise<number> {
    const result = await this.client.accountSession.updateMany({
      where: { accountId, revokedAt: null },
      data: { revokedAt },
    });
    return result.count;
  }
}

export function createPrismaAccountServiceStore(
  client: PrismaClient = db
): AccountServiceStore {
  return {
    async findAuthenticationAccountByEmail(email) {
      const account = await client.account.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          passwordHash: true,
          status: true,
          failedLoginAttempts: true,
          lockedUntil: true,
          lastLoginAt: true,
        },
      });
      return account ? mapAuthenticationAccount(account) : null;
    },
    transaction(work) {
      return client.$transaction((transactionClient) =>
        work(new PrismaAccountServiceTransaction(transactionClient))
      );
    },
  };
}
