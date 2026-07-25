import {
  AccountInvitationNotAllowedError,
  AccountLoginNotAllowedError,
  AccountNotFoundError,
  InvalidAccountTransitionError,
} from "./account.errors";
import type { AccountStatusValue, AccountWorkflowState } from "./account.types";

export const ACCOUNT_TRANSITIONS = {
  INVITED: ["ACTIVE", "DISABLED"],
  ACTIVE: ["LOCKED", "DISABLED"],
  LOCKED: ["DISABLED"],
  DISABLED: [],
} as const satisfies Record<AccountStatusValue, readonly AccountStatusValue[]>;

export function hasExpiredAccountLock(
  account: AccountWorkflowState,
  now: Date = new Date()
): boolean {
  return (
    account.status === "LOCKED" &&
    account.lockedUntil !== null &&
    account.lockedUntil <= now
  );
}

export function allowedAccountTransitions(
  account: AccountWorkflowState,
  now: Date = new Date()
): readonly AccountStatusValue[] {
  if (hasExpiredAccountLock(account, now)) {
    return ["ACTIVE", ...ACCOUNT_TRANSITIONS.LOCKED];
  }
  return ACCOUNT_TRANSITIONS[account.status];
}

export function canTransitionAccount(
  account: AccountWorkflowState,
  next: AccountStatusValue,
  now: Date = new Date()
): boolean {
  return (
    account.status === next ||
    allowedAccountTransitions(account, now).includes(next)
  );
}

export function assertAccountTransition(
  account: AccountWorkflowState,
  next: AccountStatusValue,
  now: Date = new Date()
): void {
  if (!canTransitionAccount(account, next, now)) {
    throw new InvalidAccountTransitionError(account.status, next);
  }
}

export function isAccountLoginBlocked(
  account: AccountWorkflowState,
  now: Date = new Date()
): boolean {
  return (
    account.status === "LOCKED" &&
    (account.lockedUntil === null || account.lockedUntil > now)
  );
}

export function canAccountLogin(
  account: AccountWorkflowState,
  now: Date = new Date()
): boolean {
  return (
    account.status === "ACTIVE" ||
    hasExpiredAccountLock(account, now)
  );
}

export function assertAccountCanLogin(
  account: AccountWorkflowState,
  now: Date = new Date()
): void {
  if (!canAccountLogin(account, now)) {
    throw new AccountLoginNotAllowedError(account.status);
  }
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
