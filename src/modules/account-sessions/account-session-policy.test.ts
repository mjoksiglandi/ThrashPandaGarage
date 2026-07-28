import { describe, expect, it } from "vitest";
import {
  AccountInactiveError,
  AccountLockedError,
} from "@/modules/accounts/account.errors";
import {
  AccountSessionExpiredError,
  AccountSessionRevokedError,
} from "./account-session.errors";
import {
  assertAccountCanCreateSession,
  assertAccountSessionUsable,
  isAccountSessionExpired,
  shouldRevokeAccountSession,
} from "./account-session-policy";

const now = new Date("2026-07-25T12:00:00.000Z");
const usable = {
  expiresAt: new Date("2026-07-25T12:00:01.000Z"),
  revokedAt: null,
};

describe("account session policy", () => {
  it("allows only ACTIVE accounts to create and use sessions", () => {
    expect(() => assertAccountCanCreateSession("ACTIVE")).not.toThrow();
    expect(() => assertAccountSessionUsable(usable, "ACTIVE", now)).not.toThrow();
    expect(() => assertAccountCanCreateSession("INVITED")).toThrow(
      AccountInactiveError
    );
    expect(() => assertAccountCanCreateSession("DISABLED")).toThrow(
      AccountInactiveError
    );
  });

  it("invalidates existing sessions while the persisted account is LOCKED", () => {
    expect(() => assertAccountCanCreateSession("LOCKED")).toThrow(
      AccountLockedError
    );
    expect(() => assertAccountSessionUsable(usable, "LOCKED", now)).toThrow(
      AccountLockedError
    );
  });

  it("rejects a revoked session", () => {
    expect(() =>
      assertAccountSessionUsable({ ...usable, revokedAt: now }, "ACTIVE", now)
    ).toThrow(AccountSessionRevokedError);
  });

  it("revokes only a session that is not already revoked", () => {
    expect(shouldRevokeAccountSession({ revokedAt: null })).toBe(true);
    expect(shouldRevokeAccountSession({ revokedAt: now })).toBe(false);
  });

  it("treats expiresAt equal to now as expired", () => {
    const session = { expiresAt: now, revokedAt: null };
    expect(isAccountSessionExpired(session, now)).toBe(true);
    expect(() => assertAccountSessionUsable(session, "ACTIVE", now)).toThrow(
      AccountSessionExpiredError
    );
  });

  it("rejects a session expired before now", () => {
    expect(() =>
      assertAccountSessionUsable(
        {
          expiresAt: new Date("2026-07-25T11:59:59.999Z"),
          revokedAt: null,
        },
        "ACTIVE",
        now
      )
    ).toThrow(AccountSessionExpiredError);
  });
});
