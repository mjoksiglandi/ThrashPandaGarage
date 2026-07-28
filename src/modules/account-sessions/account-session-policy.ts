import {
  AccountInactiveError,
  AccountLockedError,
} from "@/modules/accounts/account.errors";
import type { AccountStatusValue } from "@/modules/accounts/account.types";
import {
  AccountSessionExpiredError,
  AccountSessionRevokedError,
} from "./account-session.errors";

export type AccountSessionPolicyState = {
  expiresAt: Date;
  revokedAt: Date | null;
};

export function isAccountSessionExpired(
  session: AccountSessionPolicyState,
  now: Date
): boolean {
  return session.expiresAt <= now;
}

export function shouldRevokeAccountSession(
  session: Pick<AccountSessionPolicyState, "revokedAt">
): boolean {
  return session.revokedAt === null;
}

export function assertAccountCanCreateSession(
  status: AccountStatusValue
): void {
  if (status === "LOCKED") {
    throw new AccountLockedError();
  }
  if (status !== "ACTIVE") {
    throw new AccountInactiveError();
  }
}

export function assertAccountSessionUsable(
  session: AccountSessionPolicyState,
  accountStatus: AccountStatusValue,
  now: Date
): void {
  if (session.revokedAt !== null) {
    throw new AccountSessionRevokedError();
  }
  if (isAccountSessionExpired(session, now)) {
    throw new AccountSessionExpiredError();
  }

  // A lock invalidates existing sessions until successful authentication
  // persists LOCKED -> ACTIVE, even when lockedUntil has elapsed.
  assertAccountCanCreateSession(accountStatus);
}
