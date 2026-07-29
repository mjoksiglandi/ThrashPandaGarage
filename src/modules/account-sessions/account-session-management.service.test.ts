import { AccountStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AccountInactiveError } from "@/modules/accounts/account.errors";
import type { AccountSessionPrincipal } from "./current-account-session.service";
import type {
  AccountSessionManagementStore,
  LockedAccountSessionRecord,
} from "./account-session-management.repository";
import {
  createAccountSessionManagementService,
  isAccountSessionId,
} from "./account-session-management.service";

const now = new Date("2030-01-02T03:04:05.000Z");
const currentSessionId = "c123456789012345678901234";
const otherSessionId = "c223456789012345678901234";
const foreignSessionId = "c323456789012345678901234";
const principal: AccountSessionPrincipal = {
  sessionId: currentSessionId,
  accountId: "account-a",
  clientId: "client-a",
  email: "a@example.test",
};

function session(
  id: string,
  overrides: Partial<LockedAccountSessionRecord> = {}
): LockedAccountSessionRecord {
  return {
    id,
    accountId: principal.accountId,
    createdAt: new Date(now.getTime() - 60_000),
    expiresAt: new Date(now.getTime() + 60_000),
    revokedAt: null,
    ...overrides,
  };
}

function fixture(options: {
  accountStatus?: AccountStatus;
  records?: LockedAccountSessionRecord[];
} = {}) {
  const records = new Map(
    (options.records ?? [session(otherSessionId)]).map((record) => [
      record.id,
      record,
    ])
  );
  const callOrder: string[] = [];
  const listUsable = vi.fn(async () => [
    {
      id: currentSessionId,
      createdAt: new Date(now.getTime() - 120_000),
      expiresAt: new Date(now.getTime() + 120_000),
      current: true,
    },
    {
      id: otherSessionId,
      createdAt: new Date(now.getTime() - 60_000),
      expiresAt: new Date(now.getTime() + 60_000),
      current: false,
    },
  ]);
  const transaction: AccountSessionManagementStore["transaction"] = vi.fn(
    async (work) =>
      work({
        async lockAccountById(accountId: string) {
          callOrder.push("account");
          return accountId === principal.accountId
            ? {
                id: accountId,
                email: principal.email,
                status: options.accountStatus ?? AccountStatus.ACTIVE,
                failedLoginAttempts: 0,
                lockedUntil: null,
                lastLoginAt: null,
              }
            : null;
        },
        async lockSessionByIdForAccount(
          sessionId: string,
          accountId: string
        ) {
          callOrder.push("session");
          const record = records.get(sessionId);
          return record?.accountId === accountId ? record : null;
        },
        async revokeSession(sessionId: string, revokedAt: Date) {
          callOrder.push("revoke");
          const record = records.get(sessionId);
          if (record?.revokedAt === null) {
            record.revokedAt = revokedAt;
          }
        },
      })
  );
  const store: AccountSessionManagementStore = {
    listUsable,
    transaction,
  };
  return {
    service: createAccountSessionManagementService({
      store,
      clock: { now: () => new Date(now) },
    }),
    records,
    callOrder,
    listUsable,
    transaction,
  };
}

describe("active account session management", () => {
  it("lists using only the authenticated account and current session IDs", async () => {
    const test = fixture();
    const forged = {
      ...principal,
      requestedAccountId: "account-b",
      tokenHash: "forged",
    };

    await expect(test.service.list(forged)).resolves.toEqual([
      expect.objectContaining({ id: currentSessionId, current: true }),
      expect.objectContaining({ id: otherSessionId, current: false }),
    ]);
    expect(test.listUsable).toHaveBeenCalledWith(
      principal.accountId,
      principal.sessionId,
      now
    );
    expect(JSON.stringify(await test.service.list(principal))).not.toMatch(
      /token|digest|passwordHash|accessToken/
    );
  });

  it("validates the opaque persisted identifier homogeneously", async () => {
    const test = fixture();

    expect(isAccountSessionId(otherSessionId)).toBe(true);
    expect(isAccountSessionId("not-a-session-id")).toBe(false);
    await expect(
      test.service.revokeOwned(principal, "not-a-session-id")
    ).resolves.toEqual({ revoked: false });
    expect(test.transaction).not.toHaveBeenCalled();
  });

  it("locks Account before AccountSession and revokes another owned session", async () => {
    const test = fixture();

    await expect(
      test.service.revokeOwned(principal, otherSessionId)
    ).resolves.toEqual({ revoked: true });
    expect(test.callOrder).toEqual(["account", "session", "revoke"]);
    expect(test.records.get(otherSessionId)?.revokedAt).toEqual(now);
  });

  it.each([
    ["foreign", foreignSessionId],
    ["missing", "c423456789012345678901234"],
  ])("returns the same result for a %s session", async (_, targetId) => {
    const test = fixture({
      records: [
        session(foreignSessionId, { accountId: "account-b" }),
      ],
    });

    await expect(
      test.service.revokeOwned(principal, targetId)
    ).resolves.toEqual({ revoked: false });
    expect(test.records.get(foreignSessionId)?.revokedAt).toBeNull();
  });

  it.each([
    [
      "revoked",
      session(otherSessionId, {
        revokedAt: new Date(now.getTime() - 1),
      }),
    ],
    [
      "expired",
      session(otherSessionId, {
        expiresAt: new Date(now.getTime() - 1),
      }),
    ],
  ])("does not change an already %s session", async (_, record) => {
    const test = fixture({ records: [record] });

    await expect(
      test.service.revokeOwned(principal, otherSessionId)
    ).resolves.toEqual({ revoked: false });
    expect(test.callOrder).toEqual(["account", "session"]);
  });

  it("is idempotent on retry", async () => {
    const test = fixture();

    await expect(
      test.service.revokeOwned(principal, otherSessionId)
    ).resolves.toEqual({ revoked: true });
    await expect(
      test.service.revokeOwned(principal, otherSessionId)
    ).resolves.toEqual({ revoked: false });
  });

  it("fails closed before the child lock when the account is disabled", async () => {
    const test = fixture({ accountStatus: AccountStatus.DISABLED });

    await expect(
      test.service.revokeOwned(principal, otherSessionId)
    ).rejects.toBeInstanceOf(AccountInactiveError);
    expect(test.callOrder).toEqual(["account"]);
  });
});
