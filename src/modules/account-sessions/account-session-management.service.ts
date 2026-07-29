import type { AccountSessionPrincipal } from "./current-account-session.service";
import type {
  AccountSessionManagementStore,
} from "./account-session-management.repository";
import { assertAccountCanCreateSession } from "./account-session-policy";

const ACCOUNT_SESSION_ID_PATTERN = /^c[a-z0-9]{24}$/;

type AccountSessionManagementDependencies = {
  store: AccountSessionManagementStore;
  clock: { now(): Date };
};

export function isAccountSessionId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    ACCOUNT_SESSION_ID_PATTERN.test(value)
  );
}

export function createAccountSessionManagementService(
  dependencies: AccountSessionManagementDependencies
) {
  return {
    list(principal: AccountSessionPrincipal) {
      return dependencies.store.listUsable(
        principal.accountId,
        principal.sessionId,
        dependencies.clock.now()
      );
    },

    async revokeOwned(
      principal: AccountSessionPrincipal,
      targetSessionId: unknown
    ) {
      if (!isAccountSessionId(targetSessionId)) {
        return { revoked: false as const };
      }

      const now = dependencies.clock.now();
      return dependencies.store.transaction(async (transaction) => {
        // Global identity lock order: Account, then AccountSession.
        const account = await transaction.lockAccountById(
          principal.accountId
        );
        if (!account) {
          return { revoked: false as const };
        }
        assertAccountCanCreateSession(account.status);

        const session =
          await transaction.lockSessionByIdForAccount(
            targetSessionId,
            principal.accountId
          );
        if (
          !session ||
          session.revokedAt !== null ||
          session.expiresAt <= now
        ) {
          return { revoked: false as const };
        }

        await transaction.revokeSession(session.id, now);
        return { revoked: true as const };
      });
    },
  };
}
