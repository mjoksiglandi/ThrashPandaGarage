import { describe, expect, it, vi } from "vitest";
import {
  InvalidAccountEmailError,
} from "@/modules/accounts/account.errors";
import { normalizeAccountEmail } from "@/modules/accounts/account-email";
import {
  sha256TokenHasher,
} from "@/modules/accounts/secure-token";
import type {
  PasswordRecoveryAccount,
  PasswordRecoveryRecord,
  PasswordRecoveryStore,
} from "./password-recovery.repository";
import {
  PASSWORD_RECOVERY_DURATION_MS,
  createPasswordRecoveryService,
  isPasswordRecoveryUsable,
  parsePasswordRecoveryEmail,
} from "./password-recovery.service";

function token(label: string) {
  return Buffer.from(label).toString("base64url").padEnd(43, "_");
}

function testStore(
  account: PasswordRecoveryAccount | null
): PasswordRecoveryStore & { records: PasswordRecoveryRecord[] } {
  const records: PasswordRecoveryRecord[] = [];
  let sequence = 0;
  return {
    records,
    async findAccountByEmail() {
      return account ? { id: account.id } : null;
    },
    async transaction(work) {
      return work({
        async lockAccountById(id) {
          return account?.id === id ? account : null;
        },
        async revokeOpenRequests(accountId, revokedAt) {
          let count = 0;
          for (const recovery of records) {
            if (
              recovery.accountId === accountId &&
              recovery.consumedAt === null &&
              recovery.revokedAt === null
            ) {
              recovery.revokedAt = revokedAt;
              count += 1;
            }
          }
          return count;
        },
        async createRequest(input) {
          sequence += 1;
          const recovery = {
            id: `recovery-${sequence}`,
            ...input,
            consumedAt: null,
            revokedAt: null,
          };
          records.push(recovery);
          return recovery;
        },
      });
    },
    async revokeAfterDeliveryFailure(id, revokedAt) {
      const recovery = records.find((candidate) => candidate.id === id);
      if (
        recovery &&
        recovery.consumedAt === null &&
        recovery.revokedAt === null
      ) {
        recovery.revokedAt = revokedAt;
      }
    },
  };
}

function serviceFixture(options: {
  account?: PasswordRecoveryAccount | null;
  tokens?: string[];
  smtpFailure?: boolean;
} = {}) {
  const account =
    options.account === undefined
      ? {
          id: "account-1",
          email: "person@example.test",
          passwordHash: "password-hash",
          status: "ACTIVE" as const,
        }
      : options.account;
  const store = testStore(account);
  const sent: Array<{
    to: string;
    token: string;
    expiresInMinutes: number;
  }> = [];
  const failures: Array<{ recoveryId: string; accountId: string }> = [];
  const values = options.tokens ?? [token("recovery-token")];
  let index = 0;
  const clock = {
    value: new Date("2026-07-26T12:00:00.000Z"),
    now() {
      return new Date(this.value);
    },
  };
  const service = createPasswordRecoveryService({
    store,
    clock,
    tokenGenerator: {
      generate() {
        const value = values[index];
        index += 1;
        if (!value) throw new Error("Token generator exhausted");
        return value;
      },
    },
    tokenHasher: sha256TokenHasher,
    durationMs: PASSWORD_RECOVERY_DURATION_MS,
    mailer: {
      async send(input) {
        sent.push(input);
        if (options.smtpFailure) throw new Error("token must stay private");
      },
    },
    logger: {
      deliveryFailed(input) {
        failures.push(input);
      },
    },
  });
  return { clock, failures, sent, service, store };
}

describe("password recovery policy", () => {
  it("normalizes with the canonical account email policy", () => {
    expect(parsePasswordRecoveryEmail(" Person@Example.TEST ")).toBe(
      "person@example.test"
    );
  });

  it.each([undefined, 42, "", "not-an-email", "a".repeat(255)])(
    "rejects invalid email input %j",
    (value) => {
      expect(() => parsePasswordRecoveryEmail(value)).toThrow(
        InvalidAccountEmailError
      );
    }
  );

  it("accepts only unconsumed, unrevoked requests before expiry", () => {
    const expiresAt = new Date("2026-07-26T13:00:00.000Z");
    const base = {
      expiresAt,
      consumedAt: null,
      revokedAt: null,
    };
    expect(
      isPasswordRecoveryUsable(
        base,
        new Date("2026-07-26T12:59:59.999Z")
      )
    ).toBe(true);
    expect(isPasswordRecoveryUsable(base, expiresAt)).toBe(false);
    expect(
      isPasswordRecoveryUsable(
        { ...base, consumedAt: new Date() },
        new Date("2026-07-26T12:00:00.000Z")
      )
    ).toBe(false);
    expect(
      isPasswordRecoveryUsable(
        { ...base, revokedAt: new Date() },
        new Date("2026-07-26T12:00:00.000Z")
      )
    ).toBe(false);
  });
});

describe("password recovery service", () => {
  it("stores only the digest, expires in 60 minutes, and sends the token", async () => {
    const fixture = serviceFixture();
    const email = normalizeAccountEmail("person@example.test");

    await fixture.service.request(email);

    const recovery = fixture.store.records[0];
    expect(recovery.tokenHash).toBe(
      sha256TokenHasher.digest(fixture.sent[0].token)
    );
    expect(recovery.tokenHash).not.toBe(fixture.sent[0].token);
    expect(recovery.expiresAt).toEqual(
      new Date("2026-07-26T13:00:00.000Z")
    );
    expect(fixture.sent).toEqual([
      {
        to: "person@example.test",
        token: token("recovery-token"),
        expiresInMinutes: 60,
      },
    ]);
  });

  it("revokes the previous open request before creating a new one", async () => {
    const fixture = serviceFixture({
      tokens: [token("first-token"), token("second-token")],
    });
    const email = normalizeAccountEmail("person@example.test");

    await fixture.service.request(email);
    fixture.clock.value = new Date("2026-07-26T12:01:00.000Z");
    await fixture.service.request(email);

    expect(fixture.store.records).toHaveLength(2);
    expect(fixture.store.records[0].revokedAt).toEqual(
      fixture.clock.value
    );
    expect(fixture.store.records[1].revokedAt).toBeNull();
  });

  it.each([
    { label: "missing", account: null },
    {
      label: "invited",
      account: {
        id: "account-1",
        email: "person@example.test",
        passwordHash: null,
        status: "INVITED" as const,
      },
    },
    {
      label: "disabled",
      account: {
        id: "account-1",
        email: "person@example.test",
        passwordHash: "hash",
        status: "DISABLED" as const,
      },
    },
    {
      label: "active without password",
      account: {
        id: "account-1",
        email: "person@example.test",
        passwordHash: null,
        status: "ACTIVE" as const,
      },
    },
  ])("does nothing for a $label account", async ({ account }) => {
    const fixture = serviceFixture({ account });
    await fixture.service.request(
      normalizeAccountEmail("person@example.test")
    );
    expect(fixture.store.records).toHaveLength(0);
    expect(fixture.sent).toHaveLength(0);
  });

  it("revokes a request after SMTP failure and logs identifiers only", async () => {
    const fixture = serviceFixture({ smtpFailure: true });

    await fixture.service.request(
      normalizeAccountEmail("person@example.test")
    );

    expect(fixture.store.records[0].revokedAt).toEqual(
      fixture.clock.value
    );
    expect(fixture.failures).toEqual([
      { recoveryId: "recovery-1", accountId: "account-1" },
    ]);
    expect(JSON.stringify(fixture.failures)).not.toContain(
      token("recovery-token")
    );
  });

  it("does not expose the token through its return value", async () => {
    const fixture = serviceFixture();
    await expect(
      fixture.service.request(
        normalizeAccountEmail("person@example.test")
      )
    ).resolves.toBeUndefined();
  });
});
