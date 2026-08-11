import { describe, expect, it, vi } from "vitest";
import {
  AccountInactiveError,
  AccountLockedError,
  InvalidCredentialsError,
} from "./account.errors";
import type {
  AccountServiceStore,
  AccountServiceTransaction,
  AuthenticationAccountRecord,
} from "./account-service.repository";
import {
  createAccountLoginService,
  parseAccountLoginInput,
} from "./account-login.service";
import {
  ACCOUNT_LOGIN_LOCK_POLICY,
  ACCOUNT_SESSION_DURATION_MS,
  LOGIN_PASSWORD_MAX_BYTES,
} from "./account-login-policy";
import type {
  AuthenticationAttemptService,
} from "./authentication-attempt.service";
import type {
  AccountSessionService,
} from "@/modules/account-sessions/account-session.service";

const now = new Date("2026-07-26T12:00:00.000Z");
const expiresAt = new Date("2026-08-25T12:00:00.000Z");
const dummyHash = "$2b$12$dummy";

function candidate(
  overrides: Partial<AuthenticationAccountRecord> = {}
): AuthenticationAccountRecord {
  return {
    id: "account-1",
    email: "person@example.test",
    passwordHash: "stored-hash",
    status: "ACTIVE",
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    ...overrides,
  };
}

function fixture(options: {
  account?: AuthenticationAccountRecord | null;
  passwordMatches?: boolean;
  successfulError?: Error;
  failedError?: Error;
} = {}) {
  const account =
    options.account === undefined ? candidate() : options.account;
  const transaction = {} as AccountServiceTransaction;
  const findAuthenticationAccountByEmail = vi.fn(async () => account);
  const store = {
    findAuthenticationAccountByEmail,
    transaction: vi.fn(async (work) => work(transaction)),
  } as unknown as AccountServiceStore;
  const recordFailedAttempt = vi.fn(async () => {
    if (options.failedError) {
      throw options.failedError;
    }
    return {
      accountId: account?.id ?? "",
      status: "ACTIVE" as const,
      failedLoginAttempts: 1,
      lockedUntil: null,
    };
  });
  const recordSuccessfulAuthenticationWithinTransaction = vi.fn(
    async () => {
      if (options.successfulError) {
        throw options.successfulError;
      }
      const activeAccount = candidate({
        ...account,
        status: "ACTIVE",
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: now,
      });
      return {
        account: activeAccount,
        accountId: activeAccount.id,
        status: "ACTIVE" as const,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: now,
      };
    }
  );
  const authenticationAttempts = {
    recordFailedAttempt,
    recordSuccessfulAuthenticationWithinTransaction,
  } as unknown as AuthenticationAttemptService;
  const createWithinTransaction = vi.fn(async () => ({
    sessionId: "session-internal",
    accountId: account?.id ?? "",
    expiresAt,
    token: "opaque-session-token",
  }));
  const accountSessions = {
    createWithinTransaction,
  } as unknown as AccountSessionService;
  const verify = vi.fn(
    async () => options.passwordMatches ?? true
  );
  const service = createAccountLoginService({
    store,
    authenticationAttempts,
    accountSessions,
    passwordVerifier: { verify },
    nonexistentAccountPasswordHash: dummyHash,
  });

  return {
    service,
    transaction,
    findAuthenticationAccountByEmail,
    recordFailedAttempt,
    recordSuccessfulAuthenticationWithinTransaction,
    createWithinTransaction,
    verify,
  };
}

describe("account login input", () => {
  it("fixes the production lock and session durations", () => {
    expect(ACCOUNT_LOGIN_LOCK_POLICY).toEqual({
      failedAttemptThreshold: 5,
      lockDurationMs: 15 * 60 * 1000,
    });
    expect(ACCOUNT_SESSION_DURATION_MS).toBe(
      30 * 24 * 60 * 60 * 1000
    );
  });

  it("normalizes email with the canonical account policy", () => {
    expect(
      parseAccountLoginInput({
        email: "  PERSON@Example.Test ",
        password: "valid password",
      })
    ).toEqual({
      email: "person@example.test",
      password: "valid password",
    });
  });

  it.each([
    { email: "invalid", password: "valid password" },
    { email: "person@example.test", password: "" },
    { email: "person@example.test", password: "   " },
  ])("rejects malformed input before authentication", (input) => {
    expect(() => parseAccountLoginInput(input)).toThrow(
      InvalidCredentialsError
    );
  });

  it("enforces bcrypt's real 72-byte UTF-8 boundary without truncation", () => {
    const atBoundary = "é".repeat(LOGIN_PASSWORD_MAX_BYTES / 2);
    const overBoundary = `${atBoundary}é`;

    expect(Buffer.byteLength(atBoundary, "utf8")).toBe(72);
    expect(() =>
      parseAccountLoginInput({
        email: "person@example.test",
        password: atBoundary,
      })
    ).not.toThrow();
    expect(() =>
      parseAccountLoginInput({
        email: "person@example.test",
        password: overBoundary,
      })
    ).toThrow(InvalidCredentialsError);
  });
});

describe("account login service", () => {
  it("uses the sentinel bcrypt hash and the same failed-attempt service for an unknown account", async () => {
    const test = fixture({ account: null, passwordMatches: false });

    await expect(
      test.service.authenticate({
        email: "UNKNOWN@EXAMPLE.TEST",
        password: "wrong password",
      })
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(test.verify).toHaveBeenCalledWith(
      "wrong password",
      dummyHash
    );
    expect(test.recordFailedAttempt).toHaveBeenCalledWith({
      email: "unknown@example.test",
    });
    expect(test.createWithinTransaction).not.toHaveBeenCalled();
  });

  it("records an incorrect password for an existing account", async () => {
    const test = fixture({ passwordMatches: false });

    await expect(
      test.service.authenticate({
        email: "person@example.test",
        password: "wrong password",
      })
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(test.verify).toHaveBeenCalledWith(
      "wrong password",
      "stored-hash"
    );
    expect(test.recordFailedAttempt).toHaveBeenCalledWith({
      accountId: "account-1",
    });
  });

  it.each([
    ["INVITED", new AccountInactiveError()],
    ["LOCKED", new AccountLockedError()],
    ["DISABLED", new AccountInactiveError()],
  ] as const)(
    "returns the same domain error for a %s account",
    async (status, successfulError) => {
      const test = fixture({
        account: candidate({ status }),
        successfulError,
      });

      await expect(
        test.service.authenticate({
          email: "person@example.test",
          password: "correct password",
        })
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
      expect(test.createWithinTransaction).not.toHaveBeenCalled();
    }
  );

  it("revalidates and creates only a minimal successful result in one transaction", async () => {
    const test = fixture();

    await expect(
      test.service.authenticate({
        email: "person@example.test",
        password: "correct password",
      })
    ).resolves.toEqual({
      token: "opaque-session-token",
      expiresAt,
    });
    expect(
      test.recordSuccessfulAuthenticationWithinTransaction
    ).toHaveBeenCalledWith(test.transaction, {
      accountId: "account-1",
      expectedPasswordHash: "stored-hash",
    });
    expect(test.createWithinTransaction).toHaveBeenCalledOnce();
  });

  it("creates no session when the locked revalidation detects a changed password", async () => {
    const test = fixture({
      successfulError: new InvalidCredentialsError(),
    });

    await expect(
      test.service.authenticate({
        email: "person@example.test",
        password: "previous correct password",
      })
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(test.createWithinTransaction).not.toHaveBeenCalled();
  });

  it("keeps password hashes, account IDs, and session IDs out of its result", async () => {
    const test = fixture();
    const result = await test.service.authenticate({
      email: "person@example.test",
      password: "correct password",
    });

    expect(Object.keys(result).sort()).toEqual([
      "expiresAt",
      "token",
    ]);
    expect(JSON.stringify(result)).not.toContain("stored-hash");
    expect(JSON.stringify(result)).not.toContain("account-1");
    expect(JSON.stringify(result)).not.toContain("session-internal");
  });
});
