import { AccountNotFoundError } from "@/modules/accounts/account.errors";
import type { AccountServiceStore } from "@/modules/accounts/account-service.repository";
import type { Clock } from "@/modules/accounts/service-dependencies";
import { expiresAfter } from "@/modules/accounts/service-dependencies";
import type {
  OpaqueTokenGenerator,
  TokenHasher,
} from "@/modules/accounts/secure-token";
import {
  assertAccountCanCreateSession,
  assertAccountSessionUsable,
  shouldRevokeAccountSession,
} from "./account-session-policy";
import { AccountSessionNotFoundError } from "./account-session.errors";

type AccountSessionServiceDependencies = {
  store: AccountServiceStore;
  clock: Clock;
  tokenGenerator: OpaqueTokenGenerator;
  tokenHasher: TokenHasher;
  sessionDurationMs: number;
};

export function createAccountSessionService(
  dependencies: AccountSessionServiceDependencies
) {
  return {
    async create(accountId: string) {
      const now = dependencies.clock.now();
      const expiresAt = expiresAfter(now, dependencies.sessionDurationMs);

      return dependencies.store.transaction(async (transaction) => {
        const account = await transaction.lockAccountById(accountId);
        if (!account) {
          throw new AccountNotFoundError();
        }
        assertAccountCanCreateSession(account.status);

        const token = dependencies.tokenGenerator.generate();
        const tokenHash = dependencies.tokenHasher.digest(token);
        const session = await transaction.createSession({
          accountId,
          tokenHash,
          expiresAt,
          createdAt: now,
        });
        return {
          sessionId: session.id,
          accountId,
          expiresAt: session.expiresAt,
          token,
        };
      });
    },

    async validate(token: string) {
      const now = dependencies.clock.now();
      const tokenHash = dependencies.tokenHasher.digest(token);

      return dependencies.store.transaction(async (transaction) => {
        const session = await transaction.lockSessionByTokenHash(tokenHash);
        if (!session) {
          throw new AccountSessionNotFoundError();
        }
        assertAccountSessionUsable(session, session.account.status, now);
        return {
          sessionId: session.id,
          accountId: session.accountId,
          expiresAt: session.expiresAt,
        };
      });
    },

    async revoke(token: string) {
      const now = dependencies.clock.now();
      const tokenHash = dependencies.tokenHasher.digest(token);

      return dependencies.store.transaction(async (transaction) => {
        const session = await transaction.lockSessionByTokenHash(tokenHash);
        if (!session) {
          throw new AccountSessionNotFoundError();
        }
        if (shouldRevokeAccountSession(session)) {
          await transaction.revokeSession(session.id, now);
        }
        return {
          sessionId: session.id,
          accountId: session.accountId,
          revokedAt: session.revokedAt ?? now,
        };
      });
    },

    async revokeAll(accountId: string) {
      const now = dependencies.clock.now();
      return dependencies.store.transaction(async (transaction) => {
        const account = await transaction.lockAccountById(accountId);
        if (!account) {
          throw new AccountNotFoundError();
        }
        const revokedCount = await transaction.revokeAllSessions(accountId, now);
        return { accountId, revokedAt: now, revokedCount };
      });
    },
  };
}
