import { AccountNotFoundError } from "./account.errors";
import { normalizeAccountEmail } from "./account-email";
import type {
  AccountServiceStore,
  AccountServiceTransaction,
} from "./account-service.repository";
import {
  nextFailedLoginState,
  successfulLoginState,
  type LoginLockPolicy,
} from "./account-workflow";
import type { Clock } from "./service-dependencies";

export type AuthenticationAccountSelector =
  | { accountId: string; email?: never }
  | { accountId?: never; email: string };

type AuthenticationAttemptServiceDependencies = {
  store: AccountServiceStore;
  clock: Clock;
  lockPolicy: LoginLockPolicy;
};

async function lockSelectedAccount(
  transaction: AccountServiceTransaction,
  selector: AuthenticationAccountSelector
) {
  if (selector.accountId !== undefined) {
    return transaction.lockAccountById(selector.accountId);
  }
  return transaction.lockAccountByEmail(
    normalizeAccountEmail(selector.email as string)
  );
}

export function createAuthenticationAttemptService(
  dependencies: AuthenticationAttemptServiceDependencies
) {
  return {
    async recordFailedAttempt(selector: AuthenticationAccountSelector) {
      const now = dependencies.clock.now();
      return dependencies.store.transaction(async (transaction) => {
        const account = await lockSelectedAccount(transaction, selector);
        if (!account) {
          throw new AccountNotFoundError();
        }

        const next = nextFailedLoginState(
          account,
          now,
          dependencies.lockPolicy
        );
        await transaction.updateAccount(account.id, next);
        return {
          accountId: account.id,
          status: next.status,
          failedLoginAttempts: next.failedLoginAttempts,
          lockedUntil: next.lockedUntil,
        };
      });
    },

    async recordSuccessfulAuthentication(
      selector: AuthenticationAccountSelector
    ) {
      const now = dependencies.clock.now();
      return dependencies.store.transaction(async (transaction) => {
        const account = await lockSelectedAccount(transaction, selector);
        if (!account) {
          throw new AccountNotFoundError();
        }

        const next = successfulLoginState(account, now);
        await transaction.updateAccount(account.id, {
          ...next,
          lastLoginAt: now,
        });
        return {
          accountId: account.id,
          status: next.status,
          failedLoginAttempts: next.failedLoginAttempts,
          lockedUntil: next.lockedUntil,
          lastLoginAt: now,
        };
      });
    },
  };
}
