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

type LockedInvitationRow = InvitationRecord & {
  accountEmail: string;
  accountStatus: AccountStatusValue;
  accountFailedLoginAttempts: number;
  accountLockedUntil: Date | null;
  accountLastLoginAt: Date | null;
};

type LockedSessionRow = AccountSessionRecord & {
  accountClientId: string;
  accountEmail: string;
  accountStatus: AccountStatusValue;
  accountFailedLoginAttempts: number;
  accountLockedUntil: Date | null;
  accountLastLoginAt: Date | null;
};

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
  row: LockedInvitationRow
): InvitationWithAccountRecord {
  return {
    id: row.id,
    accountId: row.accountId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    acceptedAt: row.acceptedAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
    account: {
      id: row.accountId,
      email: row.accountEmail,
      status: row.accountStatus,
      failedLoginAttempts: row.accountFailedLoginAttempts,
      lockedUntil: row.accountLockedUntil,
      lastLoginAt: row.accountLastLoginAt,
    },
  };
}

function mapSessionWithAccount(
  row: LockedSessionRow
): AccountSessionWithAccountRecord {
  return {
    id: row.id,
    accountId: row.accountId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
    account: {
      id: row.accountId,
      clientId: row.accountClientId,
      email: row.accountEmail,
      status: row.accountStatus,
      failedLoginAttempts: row.accountFailedLoginAttempts,
      lockedUntil: row.accountLockedUntil,
      lastLoginAt: row.accountLastLoginAt,
    },
  };
}

class PrismaAccountServiceTransaction implements AccountServiceTransaction {
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
    const rows = await this.client.$queryRaw<LockedInvitationRow[]>`
      SELECT
        invitation.id,
        invitation."accountId",
        invitation."tokenHash",
        invitation."expiresAt",
        invitation."acceptedAt",
        invitation."revokedAt",
        invitation."createdAt",
        account.email AS "accountEmail",
        account.status AS "accountStatus",
        account."failedLoginAttempts" AS "accountFailedLoginAttempts",
        account."lockedUntil" AS "accountLockedUntil",
        account."lastLoginAt" AS "accountLastLoginAt"
      FROM "Invitation" AS invitation
      JOIN "Account" AS account ON account.id = invitation."accountId"
      WHERE invitation."tokenHash" = ${tokenHash}
      FOR UPDATE OF account, invitation
    `;
    return rows[0] ? mapInvitationWithAccount(rows[0]) : null;
  }

  async lockSessionByTokenHash(
    tokenHash: TokenHash
  ): Promise<AccountSessionWithAccountRecord | null> {
    const rows = await this.client.$queryRaw<LockedSessionRow[]>`
      SELECT
        session.id,
        session."accountId",
        session."tokenHash",
        session."expiresAt",
        session."revokedAt",
        session."createdAt",
        account."clientId" AS "accountClientId",
        account.email AS "accountEmail",
        account.status AS "accountStatus",
        account."failedLoginAttempts" AS "accountFailedLoginAttempts",
        account."lockedUntil" AS "accountLockedUntil",
        account."lastLoginAt" AS "accountLastLoginAt"
      FROM "AccountSession" AS session
      JOIN "Account" AS account ON account.id = session."accountId"
      WHERE session."tokenHash" = ${tokenHash}
      FOR UPDATE OF account, session
    `;
    return rows[0] ? mapSessionWithAccount(rows[0]) : null;
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
