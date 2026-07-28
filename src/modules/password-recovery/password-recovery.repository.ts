import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import type { TokenHash } from "@/lib/token-hash";
import type { NormalizedAccountEmail } from "@/modules/accounts/account-email";
import type { AccountStatusValue } from "@/modules/accounts/account.types";

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
    const result =
      await this.client.accountPasswordRecovery.updateMany({
        where: {
          accountId,
          consumedAt: null,
          revokedAt: null,
        },
        data: { revokedAt },
      });
    return result.count;
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
