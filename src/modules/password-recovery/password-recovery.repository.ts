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
    const candidate =
      await this.resetClient.accountPasswordRecovery.findUnique({
        where: { tokenHash },
        select: { accountId: true },
      });
    if (!candidate) {
      return null;
    }

    // Global identity lock order: Account, then its child row.
    const account = await this.lockAuthenticationAccountById(
      candidate.accountId
    );
    if (!account) {
      return null;
    }

    const recoveries =
      await this.resetClient.$queryRaw<PasswordRecoveryRecord[]>`
        SELECT
          id,
          "accountId",
          "tokenHash",
          "expiresAt",
          "consumedAt",
          "revokedAt",
          "createdAt"
        FROM "AccountPasswordRecovery"
        WHERE "tokenHash" = ${tokenHash}
          AND "accountId" = ${candidate.accountId}
        FOR UPDATE
      `;
    return recoveries[0]
      ? {
          ...recoveries[0],
          account,
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
