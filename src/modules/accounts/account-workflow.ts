import {
  AccountInactiveError,
  AccountInvitationNotAllowedError,
  AccountLockedError,
  AccountLoginNotAllowedError,
  AccountNotFoundError,
  InvalidAccountPolicyError,
  InvalidAccountTransitionError,
} from "./account.errors";
import type { AccountStatusValue, AccountWorkflowState } from "./account.types";

export const ACCOUNT_TRANSITIONS = {
  INVITED: ["ACTIVE", "DISABLED"],
  ACTIVE: ["LOCKED", "DISABLED"],
  LOCKED: ["DISABLED"],
  DISABLED: [],
} as const satisfies Record<AccountStatusValue, readonly AccountStatusValue[]>;

function hasExpiredAccountLock(
  account: AccountWorkflowState,
  now: Date
): boolean {
  return (
    account.status === "LOCKED" &&
    account.lockedUntil !== null &&
    account.lockedUntil <= now
  );
}

export function allowedAccountTransitions(
  account: AccountWorkflowState,
  now: Date
): readonly AccountStatusValue[] {
  if (hasExpiredAccountLock(account, now)) {
    return ["ACTIVE", ...ACCOUNT_TRANSITIONS.LOCKED];
  }
  return ACCOUNT_TRANSITIONS[account.status];
}

export function canTransitionAccount(
  account: AccountWorkflowState,
  next: AccountStatusValue,
  now: Date
): boolean {
  return (
    account.status === next ||
    allowedAccountTransitions(account, now).includes(next)
  );
}

export function assertAccountTransition(
  account: AccountWorkflowState,
  next: AccountStatusValue,
  now: Date
): void {
  if (!canTransitionAccount(account, next, now)) {
    throw new InvalidAccountTransitionError(account.status, next);
  }
}

export function isAccountLoginBlocked(
  account: AccountWorkflowState,
  now: Date
): boolean {
  return (
    account.status === "LOCKED" &&
    (account.lockedUntil === null || account.lockedUntil > now)
  );
}

export function canAccountLogin(
  account: AccountWorkflowState,
  now: Date
): boolean {
  return (
    account.status === "ACTIVE" ||
    hasExpiredAccountLock(account, now)
  );
}

export function assertAccountCanLogin(
  account: AccountWorkflowState,
  now: Date
): void {
  if (!canAccountLogin(account, now)) {
    throw new AccountLoginNotAllowedError(account.status);
  }
}

export type LoginLockPolicy = {
  failedAttemptThreshold: number;
  lockDurationMs: number;
};

export type LoginAttemptState = AccountWorkflowState & {
  failedLoginAttempts: number;
};

function assertLoginLockPolicy(policy: LoginLockPolicy): void {
  if (
    !Number.isInteger(policy.failedAttemptThreshold) ||
    policy.failedAttemptThreshold < 1 ||
    !Number.isInteger(policy.lockDurationMs) ||
    policy.lockDurationMs < 1
  ) {
    throw new InvalidAccountPolicyError();
  }
}

export function nextFailedLoginState(
  account: LoginAttemptState,
  now: Date,
  policy: LoginLockPolicy
): LoginAttemptState {
  assertLoginLockPolicy(policy);
  if (account.status === "INVITED" || account.status === "DISABLED") {
    throw new AccountInactiveError();
  }
  if (isAccountLoginBlocked(account, now)) {
    throw new AccountLockedError();
  }

  const failedLoginAttempts = hasExpiredAccountLock(account, now)
    ? 1
    : account.failedLoginAttempts + 1;
  if (failedLoginAttempts >= policy.failedAttemptThreshold) {
    return {
      status: "LOCKED",
      failedLoginAttempts,
      lockedUntil: new Date(now.getTime() + policy.lockDurationMs),
    };
  }

  return {
    status: "ACTIVE",
    failedLoginAttempts,
    lockedUntil: null,
  };
}

export function successfulLoginState(
  account: LoginAttemptState,
  now: Date
): LoginAttemptState {
  if (account.status === "INVITED" || account.status === "DISABLED") {
    throw new AccountInactiveError();
  }
  if (isAccountLoginBlocked(account, now)) {
    throw new AccountLockedError();
  }
  return {
    status: "ACTIVE",
    failedLoginAttempts: 0,
    lockedUntil: null,
  };
}

export function canIssueInvitation(
  account: Pick<AccountWorkflowState, "status"> | null
): boolean {
  return account?.status === "INVITED";
}

export function assertCanIssueInvitation(
  account: Pick<AccountWorkflowState, "status"> | null
): void {
  if (!account) {
    throw new AccountNotFoundError();
  }
  if (!canIssueInvitation(account)) {
    throw new AccountInvitationNotAllowedError(account.status);
  }
}
