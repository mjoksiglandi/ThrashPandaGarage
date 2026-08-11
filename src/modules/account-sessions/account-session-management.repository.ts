import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import {
  PrismaAccountServiceTransaction,
  type AccountServiceTransaction,
} from "@/modules/accounts/account-service.repository";

type ActiveAccountSessionRecord = {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  current: boolean;
};

export type LockedAccountSessionRecord = {
  id: string;
  accountId: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
};

interface AccountSessionManagementTransaction
  extends Pick<
    AccountServiceTransaction,
    "lockAccountById" | "revokeSession"
  > {
  lockSessionByIdForAccount(
    sessionId: string,
    accountId: string
  ): Promise<LockedAccountSessionRecord | null>;
}

export interface AccountSessionManagementStore {
  listUsable(
    accountId: string,
    currentSessionId: string,
    now: Date
  ): Promise<ActiveAccountSessionRecord[]>;
  transaction<T>(
    work: (
      transaction: AccountSessionManagementTransaction
    ) => Promise<T>
  ): Promise<T>;
}

class PrismaAccountSessionManagementTransaction
  extends PrismaAccountServiceTransaction
  implements AccountSessionManagementTransaction
{
  constructor(private readonly sessionClient: Prisma.TransactionClient) {
    super(sessionClient);
  }

  async lockSessionByIdForAccount(
    sessionId: string,
    accountId: string
  ): Promise<LockedAccountSessionRecord | null> {
    const sessions =
      await this.sessionClient.$queryRaw<LockedAccountSessionRecord[]>`
        SELECT
          id,
          "accountId",
          "createdAt",
          "expiresAt",
          "revokedAt"
        FROM "AccountSession"
        WHERE id = ${sessionId}
          AND "accountId" = ${accountId}
        FOR UPDATE
      `;
    return sessions[0] ?? null;
  }
}

export function createPrismaAccountSessionManagementStore(
  client: PrismaClient = db
): AccountSessionManagementStore {
  return {
    listUsable(accountId, currentSessionId, now) {
      return client.$queryRaw<ActiveAccountSessionRecord[]>`
        SELECT
          id,
          "createdAt",
          "expiresAt",
          (id = ${currentSessionId}) AS "current"
        FROM "AccountSession"
        WHERE "accountId" = ${accountId}
          AND "revokedAt" IS NULL
          AND "expiresAt" > ${now.toISOString()}::timestamp(3)
        ORDER BY
          CASE WHEN id = ${currentSessionId} THEN 0 ELSE 1 END,
          "createdAt" DESC,
          id ASC
      `;
    },
    transaction(work) {
      return client.$transaction((transactionClient) =>
        work(
          new PrismaAccountSessionManagementTransaction(
            transactionClient
          )
        )
      );
    },
  };
}
