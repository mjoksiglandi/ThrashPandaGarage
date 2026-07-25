import { describe, expect, it } from "vitest";
import {
  ACCOUNT_TRANSITIONS,
  allowedAccountTransitions,
  assertAccountCanLogin,
  assertAccountTransition,
  assertCanIssueInvitation,
  canAccountLogin,
  canIssueInvitation,
  canTransitionAccount,
  isAccountLoginBlocked,
} from "./account-workflow";
import {
  AccountInvitationNotAllowedError,
  AccountLoginNotAllowedError,
  AccountNotFoundError,
  InvalidAccountTransitionError,
} from "./account.errors";
import {
  ACCOUNT_STATUSES,
  type AccountStatusValue,
  type AccountWorkflowState,
} from "./account.types";

const now = new Date("2026-07-25T12:00:00.000Z");

function account(
  status: AccountStatusValue,
  lockedUntil: Date | null = null
): AccountWorkflowState {
  return { status, lockedUntil };
}

describe("account login policy", () => {
  it("rejects INVITED accounts", () => {
    const account = { status: "INVITED" as const, lockedUntil: null };
    expect(canAccountLogin(account, now)).toBe(false);
    expect(() => assertAccountCanLogin(account, now)).toThrow(AccountLoginNotAllowedError);
  });

  it("allows ACTIVE accounts", () => {
    const account = { status: "ACTIVE" as const, lockedUntil: null };
    expect(canAccountLogin(account, now)).toBe(true);
    expect(() => assertAccountCanLogin(account, now)).not.toThrow();
  });

  it("rejects a LOCKED account while lockedUntil is in the future", () => {
    const account = {
      status: "LOCKED" as const,
      lockedUntil: new Date("2026-07-25T12:00:01.000Z"),
    };
    expect(isAccountLoginBlocked(account, now)).toBe(true);
    expect(canAccountLogin(account, now)).toBe(false);
  });

  it("fails closed for a LOCKED account without lockedUntil", () => {
    const lockedAccount = account("LOCKED");
    expect(isAccountLoginBlocked(lockedAccount, now)).toBe(true);
    expect(canAccountLogin(lockedAccount, now)).toBe(false);
    expect(() => assertAccountCanLogin(lockedAccount, now)).toThrow(
      AccountLoginNotAllowedError
    );
  });

  it("allows a LOCKED account to continue when the lock has expired", () => {
    const account = {
      status: "LOCKED" as const,
      lockedUntil: new Date("2026-07-25T11:59:59.000Z"),
    };
    expect(isAccountLoginBlocked(account, now)).toBe(false);
    expect(canAccountLogin(account, now)).toBe(true);
  });

  it("treats lockedUntil equal to now as expired", () => {
    const account = { status: "LOCKED" as const, lockedUntil: now };
    expect(isAccountLoginBlocked(account, now)).toBe(false);
    expect(canAccountLogin(account, now)).toBe(true);
  });

  it("rejects DISABLED accounts", () => {
    const account = { status: "DISABLED" as const, lockedUntil: null };
    expect(canAccountLogin(account, now)).toBe(false);
    expect(() => assertAccountCanLogin(account, now)).toThrow(AccountLoginNotAllowedError);
  });
});

describe("account invitation policy", () => {
  it("allows invitations only for INVITED accounts", () => {
    for (const status of ACCOUNT_STATUSES) {
      expect(canIssueInvitation({ status }), status).toBe(status === "INVITED");
    }
  });

  it("rejects invitation issuance for DISABLED accounts", () => {
    expect(() => assertCanIssueInvitation({ status: "DISABLED" })).toThrow(
      AccountInvitationNotAllowedError
    );
  });

  it("rejects invitation issuance when the account does not exist", () => {
    expect(canIssueInvitation(null)).toBe(false);
    expect(() => assertCanIssueInvitation(null)).toThrow(AccountNotFoundError);
  });
});

describe("account transitions", () => {
  it("allows every declared transition and idempotent writes", () => {
    for (const [current, allowed] of Object.entries(ACCOUNT_TRANSITIONS) as [
      AccountStatusValue,
      readonly AccountStatusValue[],
    ][]) {
      const currentAccount = account(current);
      expect(canTransitionAccount(currentAccount, current, now)).toBe(true);
      for (const next of allowed) {
        expect(
          canTransitionAccount(currentAccount, next, now),
          `${current} -> ${next}`
        ).toBe(true);
      }
    }
  });

  it("rejects every undeclared transition", () => {
    for (const current of ACCOUNT_STATUSES) {
      const currentAccount = account(current);
      for (const next of ACCOUNT_STATUSES) {
        if (
          current === next ||
          allowedAccountTransitions(currentAccount, now).includes(next)
        ) {
          continue;
        }
        expect(
          canTransitionAccount(currentAccount, next, now),
          `${current} -> ${next}`
        ).toBe(false);
        expect(() => assertAccountTransition(currentAccount, next, now)).toThrow(
          InvalidAccountTransitionError
        );
      }
    }
  });

  it("allows LOCKED -> ACTIVE only when the lock reached its expiry", () => {
    const futureLock = account(
      "LOCKED",
      new Date("2026-07-25T12:00:01.000Z")
    );
    const expiredLock = account("LOCKED", now);

    expect(canTransitionAccount(futureLock, "ACTIVE", now)).toBe(false);
    expect(() => assertAccountTransition(futureLock, "ACTIVE", now)).toThrow(
      InvalidAccountTransitionError
    );
    expect(canTransitionAccount(expiredLock, "ACTIVE", now)).toBe(true);
  });

  it("does not allow transitions out of DISABLED", () => {
    const disabled = account("DISABLED");
    expect(allowedAccountTransitions(disabled, now)).toEqual([]);
    expect(canTransitionAccount(disabled, "ACTIVE", now)).toBe(false);
  });

  it("does not mutate the account state", () => {
    const lockedUntil = new Date("2026-07-25T12:00:01.000Z");
    const lockedAccount = account("LOCKED", lockedUntil);
    const snapshot = { ...lockedAccount };

    canAccountLogin(lockedAccount, now);
    allowedAccountTransitions(lockedAccount, now);

    expect(lockedAccount).toEqual(snapshot);
    expect(lockedAccount.lockedUntil).toBe(lockedUntil);
  });
});
