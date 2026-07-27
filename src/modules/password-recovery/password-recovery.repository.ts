import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import type { TokenHash } from "@/lib/token-hash";
import type { NormalizedAccountEmail } from "@/modules/accounts/account-email";
import type { AccountStatusValue } from "@/modules/accounts/account.types";
import {
  PrismaAccountServiceTransaction,
  type AccountServiceTransaction,
} from "@/modules/accounts/account-service.repository";

export type PasswordRecoveryAccount = {
  id: string;
  email: string;
  passwordHash: string | null;
  status: AccountStatusValue;
};

export type PasswordRecoveryRecord = {
  id: string;
  accountId: string;
  tokenHash: TokenHash;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export type PasswordResetRecord = PasswordRecoveryRecord & {
  account: PasswordRecoveryAccount;
};

export interface PasswordRecoveryTransaction {
  lockAccountById(id: string): Promise<PasswordRecoveryAccount | null>;
  revokeOpenRequests(accountId: string, revokedAt: Date): Promise<number>;
  createRequest(input: {
    accountId: string;
    tokenHash: TokenHash;
    expiresAt: Date;
    createdAt: Date;
  }): Promise<PasswordRecoveryRecord>;
}

export interface PasswordRecoveryStore {
  findAccountByEmail(
    email: NormalizedAccountEmail
  ): Promise<{ id: string } | null>;
  transaction<T>(
    work: (transaction: PasswordRecoveryTransaction) => Promise<T>
  ): Promise<T>;
  revokeAfterDeliveryFailure(id: string, revokedAt: Date): Promise<void>;
}

export interface PasswordResetTransaction
  extends Pick<
    AccountServiceTransaction,
    "updateAccount" | "revokeAllSessions"
  > {
  lockRequestByTokenHash(
    tokenHash: TokenHash
  ): Promise<PasswordResetRecord | null>;
  consumeRequest(id: string, consumedAt: Date): Promise<boolean>;
  revokeOpenRequests(
    accountId: string,
    revokedAt: Date,
    exceptRequestId: string
  ): Promise<number>;
}

export interface PasswordResetStore {
  findByTokenHash(
    tokenHash: TokenHash
  ): Promise<PasswordResetRecord | null>;
  transaction<T>(
    work: (transaction: PasswordResetTransaction) => Promise<T>
  ): Promise<T>;
}

async function revokeOpenRequests(
  client: Prisma.TransactionClient,
  accountId: string,
  revokedAt: Date,
  exceptRequestId?: string
): Promise<number> {
  const result = await client.accountPasswordRecovery.updateMany({
    where: {
      accountId,
      consumedAt: null,
      revokedAt: null,
      ...(exceptRequestId ? { id: { not: exceptRequestId } } : {}),
    },
    data: { revokedAt },
  });
  return result.count;
}

class PrismaPasswordRecoveryTransaction
  implements PasswordRecoveryTransaction
{
  constructor(private readonly client: Prisma.TransactionClient) {}

  async lockAccountById(
    id: string
  ): Promise<PasswordRecoveryAccount | null> {
    const rows = await this.client.$queryRaw<PasswordRecoveryAccount[]>`
      SELECT id, email, "passwordHash", status
      FROM "Account"
      WHERE id = ${id}
      FOR UPDATE
    `;
    return rows[0] ?? null;
  }

  async revokeOpenRequests(
    accountId: string,
    revokedAt: Date
  ): Promise<number> {
    return revokeOpenRequests(this.client, accountId, revokedAt);
  }

  async createRequest(input: {
    accountId: string;
    tokenHash: TokenHash;
    expiresAt: Date;
    createdAt: Date;
  }): Promise<PasswordRecoveryRecord> {
    const request =
      await this.client.accountPasswordRecovery.create({ data: input });
    return {
      ...request,
      tokenHash: request.tokenHash as TokenHash,
    };
  }
}

class PrismaPasswordResetTransaction
  extends PrismaAccountServiceTransaction
  implements PasswordResetTransaction
{
  constructor(private readonly resetClient: Prisma.TransactionClient) {
    super(resetClient);
  }

  async lockRequestByTokenHash(
    tokenHash: TokenHash
  ): Promise<PasswordResetRecord | null> {
    const rows = await this.resetClient.$queryRaw<
      Array<
        PasswordRecoveryRecord & {
          accountEmail: string;
          accountPasswordHash: string | null;
          accountStatus: AccountStatusValue;
        }
      >
    >`
      SELECT
        recovery.id,
        recovery."accountId",
        recovery."tokenHash",
        recovery."expiresAt",
        recovery."consumedAt",
        recovery."revokedAt",
        recovery."createdAt",
        account.email AS "accountEmail",
        account."passwordHash" AS "accountPasswordHash",
        account.status AS "accountStatus"
      FROM "AccountPasswordRecovery" AS recovery
      JOIN "Account" AS account ON account.id = recovery."accountId"
      WHERE recovery."tokenHash" = ${tokenHash}
      FOR UPDATE OF account, recovery
    `;
    const row = rows[0];
    return row
      ? {
          id: row.id,
          accountId: row.accountId,
          tokenHash: row.tokenHash,
          expiresAt: row.expiresAt,
          consumedAt: row.consumedAt,
          revokedAt: row.revokedAt,
          createdAt: row.createdAt,
          account: {
            id: row.accountId,
            email: row.accountEmail,
            passwordHash: row.accountPasswordHash,
            status: row.accountStatus,
          },
        }
      : null;
  }

  async consumeRequest(id: string, consumedAt: Date): Promise<boolean> {
    const result = await this.resetClient.accountPasswordRecovery.updateMany({
      where: { id, consumedAt: null, revokedAt: null },
      data: { consumedAt },
    });
    return result.count === 1;
  }

  revokeOpenRequests(
    accountId: string,
    revokedAt: Date,
    exceptRequestId: string
  ): Promise<number> {
    return revokeOpenRequests(
      this.resetClient,
      accountId,
      revokedAt,
      exceptRequestId
    );
  }
}

export function createPrismaPasswordRecoveryStore(
  client: PrismaClient = db
): PasswordRecoveryStore {
  return {
    async findAccountByEmail(email) {
      return client.account.findUnique({
        where: { email },
        select: { id: true },
      });
    },
    transaction(work) {
      return client.$transaction((transactionClient) =>
        work(
          new PrismaPasswordRecoveryTransaction(transactionClient)
        )
      );
    },
    async revokeAfterDeliveryFailure(id, revokedAt) {
      await client.accountPasswordRecovery.updateMany({
        where: {
          id,
          consumedAt: null,
          revokedAt: null,
        },
        data: { revokedAt },
      });
    },
  };
}

export function createPrismaPasswordResetStore(
  client: PrismaClient = db
): PasswordResetStore {
  return {
    async findByTokenHash(tokenHash) {
      const recovery = await client.accountPasswordRecovery.findUnique({
        where: { tokenHash },
        include: {
          account: {
            select: {
              id: true,
              email: true,
              passwordHash: true,
              status: true,
            },
          },
        },
      });
      return recovery
        ? {
            ...recovery,
            tokenHash: recovery.tokenHash as TokenHash,
          }
        : null;
    },
    transaction(work) {
      return client.$transaction((transactionClient) =>
        work(new PrismaPasswordResetTransaction(transactionClient))
      );
    },
  };
}
