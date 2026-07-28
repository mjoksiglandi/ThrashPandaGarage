import { describe, expect, it, vi } from "vitest";
import { InvalidCredentialsError } from "@/modules/accounts/account.errors";
import {
  ACCOUNT_PASSWORD_MAX_BYTES,
} from "@/modules/accounts/account-password-policy";
import { sha256TokenHasher } from "@/modules/accounts/secure-token";
import type {
  PasswordResetRecord,
  PasswordResetStore,
  PasswordResetTransaction,
} from "./password-recovery.repository";
import {
  createPasswordResetService,
  PasswordResetHashingError,
  PasswordResetUnavailableError,
} from "./password-reset.service";

const token = "A".repeat(43);
const now = new Date("2026-07-27T12:00:00.000Z");

function record(
  overrides: Partial<PasswordResetRecord> = {}
): PasswordResetRecord {
  return {
    id: "recovery-1",
    accountId: "account-1",
    tokenHash: sha256TokenHasher.digest(token),
    expiresAt: new Date(now.getTime() + 60_000),
    consumedAt: null,
    revokedAt: null,
    createdAt: now,
    account: {
      id: "account-1",
      email: "person@example.test",
      passwordHash: "old-hash",
      status: "ACTIVE",
    },
    ...overrides,
  };
}

function fixture(options: {
  preliminary?: PasswordResetRecord | null;
  locked?: PasswordResetRecord | null;
  hash?: (password: string) => Promise<string>;
  clock?: () => Date;
} = {}) {
  const preliminary =
    options.preliminary === undefined ? record() : options.preliminary;
  const locked = options.locked === undefined ? record() : options.locked;
  const findByTokenHash = vi.fn(async () => preliminary);
  const updateAccount = vi.fn(async () => ({
    id: "account-1",
    email: "person@example.test",
    status: "ACTIVE" as const,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
  }));
  const consumeRequest = vi.fn(async () => true);
  const revokeAllSessions = vi.fn(async () => 2);
  const revokeOpenRequests = vi.fn(async () => 1);
  const transaction = {
    lockRequestByTokenHash: vi.fn(async () => locked),
    updateAccount,
    consumeRequest,
    revokeAllSessions,
    revokeOpenRequests,
  } as unknown as PasswordResetTransaction;
  const store: PasswordResetStore = {
    findByTokenHash,
    transaction: (work) => work(transaction),
  };
  const hash = vi.fn(options.hash ?? (async () => "$2b$12$new-hash"));
  const service = createPasswordResetService({
    store,
    clock: { now: options.clock ?? (() => new Date(now)) },
    tokenHasher: sha256TokenHasher,
    passwordHasher: { hash },
  });
  return {
    service,
    transaction,
    findByTokenHash,
    hash,
    updateAccount,
    consumeRequest,
    revokeAllSessions,
    revokeOpenRequests,
  };
}

describe("password reset service", () => {
  it.each([
    ["72 ASCII bytes", "a".repeat(72)],
    ["72 multibyte bytes", "é".repeat(36)],
    ["emoji below the boundary", `secure-${"🐼".repeat(12)}`],
    ["mixed UTF-8 lengths", `${"a".repeat(12)}${"é".repeat(20)}🐼`],
  ])("accepts %s without changing the password", async (_label, password) => {
    expect(Buffer.byteLength(password, "utf8")).toBeLessThanOrEqual(
      ACCOUNT_PASSWORD_MAX_BYTES
    );
    const test = fixture();

    await test.service.reset({ token, password });

    expect(test.hash).toHaveBeenCalledWith(password);
    expect(test.updateAccount).toHaveBeenCalledWith("account-1", {
      passwordHash: "$2b$12$new-hash",
    });
  });

  it.each([
    ["empty", ""],
    ["wrong type", 42],
    ["73 ASCII bytes", "a".repeat(73)],
    ["73 multibyte bytes", `${"é".repeat(35)}abc`],
  ])("rejects %s before lookup or bcrypt", async (_label, password) => {
    const test = fixture();

    await expect(
      test.service.reset({ token, password })
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(test.findByTokenHash).not.toHaveBeenCalled();
    expect(test.hash).not.toHaveBeenCalled();
  });

  it("looks up only the SHA-256 digest and does not hash malformed tokens", async () => {
    const test = fixture({ preliminary: null });

    await expect(
      test.service.reset({
        token: "malformed",
        password: "valid-password",
      })
    ).rejects.toBeInstanceOf(PasswordResetUnavailableError);
    expect(test.findByTokenHash).toHaveBeenCalledWith("0".repeat(64));
    expect(test.hash).not.toHaveBeenCalled();
    expect(JSON.stringify(test.findByTokenHash.mock.calls)).not.toContain(
      "malformed"
    );
  });

  it.each([
    ["unknown", null],
    ["expired", record({ expiresAt: now })],
    ["consumed", record({ consumedAt: now })],
    ["revoked", record({ revokedAt: now })],
    [
      "inactive account",
      record({
        account: {
          ...record().account,
          status: "DISABLED",
        },
      }),
    ],
  ])("rejects an %s request before bcrypt", async (_label, preliminary) => {
    const test = fixture({ preliminary });

    await expect(
      test.service.reset({ token, password: "valid-password" })
    ).rejects.toBeInstanceOf(PasswordResetUnavailableError);
    expect(test.hash).not.toHaveBeenCalled();
  });

  it("hashes outside the transaction then revalidates and commits all terminal changes together", async () => {
    const calls: string[] = [];
    const test = fixture({
      hash: async () => {
        calls.push("hash");
        return "$2b$12$new-hash";
      },
    });
    test.transaction.lockRequestByTokenHash = vi.fn(async () => {
      calls.push("lock");
      return record();
    });
    test.updateAccount.mockImplementation(async () => {
      calls.push("password");
      return {
        id: "account-1",
        email: "person@example.test",
        status: "ACTIVE",
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: null,
      };
    });
    test.consumeRequest.mockImplementation(async () => {
      calls.push("consume");
      return true;
    });
    test.revokeAllSessions.mockImplementation(async () => {
      calls.push("sessions");
      return 2;
    });
    test.revokeOpenRequests.mockImplementation(async () => {
      calls.push("recoveries");
      return 1;
    });

    await expect(
      test.service.reset({ token, password: "valid-password" })
    ).resolves.toMatchObject({
      accountId: "account-1",
      recoveryId: "recovery-1",
      revokedSessions: 2,
      revokedRecoveries: 1,
    });
    expect(calls).toEqual([
      "hash",
      "lock",
      "password",
      "consume",
      "sessions",
      "recoveries",
    ]);
  });

  it("rejects expiry reached before locked revalidation without updates", async () => {
    const test = fixture({ locked: record({ expiresAt: now }) });

    await expect(
      test.service.reset({ token, password: "valid-password" })
    ).rejects.toBeInstanceOf(PasswordResetUnavailableError);
    expect(test.hash).toHaveBeenCalledOnce();
    expect(test.updateAccount).not.toHaveBeenCalled();
    expect(test.consumeRequest).not.toHaveBeenCalled();
    expect(test.revokeAllSessions).not.toHaveBeenCalled();
  });

  it.each([
    async () => {
      throw new Error("bcrypt failed");
    },
    async () => "",
  ])("sanitizes invalid or failed password hashing", async (hash) => {
    const test = fixture({ hash });

    await expect(
      test.service.reset({ token, password: "valid-password" })
    ).rejects.toBeInstanceOf(PasswordResetHashingError);
    expect(test.updateAccount).not.toHaveBeenCalled();
  });

  it("treats a lost consume race as unavailable", async () => {
    const test = fixture();
    test.consumeRequest.mockResolvedValueOnce(false);

    await expect(
      test.service.reset({ token, password: "valid-password" })
    ).rejects.toBeInstanceOf(PasswordResetUnavailableError);
    expect(test.revokeAllSessions).not.toHaveBeenCalled();
  });
});
