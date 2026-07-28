import { describe, expect, it, vi } from "vitest";
import {
  AccountInactiveError,
  AccountLockedError,
} from "@/modules/accounts/account.errors";
import { InvalidTokenError } from "@/modules/accounts/secure-token";
import {
  AccountSessionExpiredError,
  AccountSessionNotFoundError,
  AccountSessionRevokedError,
} from "./account-session.errors";
import { createCurrentAccountSessionService } from "./current-account-session.service";

const validatedSession = {
  sessionId: "session-internal",
  accountId: "account-1",
  clientId: "client-1",
  email: "person@example.test",
  expiresAt: new Date("2026-08-25T12:00:00.000Z"),
};

function fixture() {
  const validate = vi.fn(async () => validatedSession);
  const revoke = vi.fn(async () => ({
    sessionId: "session-internal",
    accountId: "account-1",
    revokedAt: new Date("2026-07-26T12:00:00.000Z"),
  }));
  const service = createCurrentAccountSessionService({
    accountSessions: { validate, revoke },
  });
  return { service, validate, revoke };
}

describe("current account session resolution", () => {
  it("returns a minimal typed principal for a valid token", async () => {
    const test = fixture();

    await expect(test.service.resolve("valid-token")).resolves.toEqual({
      kind: "authenticated",
      principal: {
        accountId: "account-1",
        clientId: "client-1",
        email: "person@example.test",
      },
    });
    expect(test.validate).toHaveBeenCalledWith("valid-token");
  });

  it.each([undefined, ""])(
    "treats an absent or empty cookie as unauthenticated",
    async (token) => {
      const test = fixture();

      await expect(test.service.resolve(token)).resolves.toEqual({
        kind: "unauthenticated",
      });
      expect(test.validate).not.toHaveBeenCalled();
    }
  );

  it.each([
    new InvalidTokenError(),
    new AccountSessionNotFoundError(),
    new AccountSessionExpiredError(),
    new AccountSessionRevokedError(),
    new AccountInactiveError(),
    new AccountLockedError(),
  ])("normalizes an invalid session to unauthenticated", async (error) => {
    const test = fixture();
    test.validate.mockRejectedValueOnce(error);

    await expect(test.service.resolve("invalid-token")).resolves.toEqual({
      kind: "unauthenticated",
    });
  });

  it("keeps internal failures distinct", async () => {
    const test = fixture();
    test.validate.mockRejectedValueOnce(new Error("database unavailable"));

    await expect(test.service.resolve("valid-token")).rejects.toThrow(
      "database unavailable"
    );
  });

  it("does not expose session IDs, tokens, digests, or password hashes", async () => {
    const test = fixture();
    const resolution = await test.service.resolve("valid-token");
    const serialized = JSON.stringify(resolution);

    expect(serialized).not.toContain("session-internal");
    expect(serialized).not.toContain("valid-token");
    expect(serialized).not.toContain("tokenHash");
    expect(serialized).not.toContain("passwordHash");
  });
});

describe("current account session logout", () => {
  it("revokes a valid session", async () => {
    const test = fixture();

    await expect(test.service.logout("valid-token")).resolves.toBeUndefined();
    expect(test.revoke).toHaveBeenCalledWith("valid-token");
  });

  it.each([undefined, ""])(
    "is successful without a usable cookie",
    async (token) => {
      const test = fixture();

      await expect(test.service.logout(token)).resolves.toBeUndefined();
      expect(test.revoke).not.toHaveBeenCalled();
    }
  );

  it.each([
    new InvalidTokenError(),
    new AccountSessionNotFoundError(),
  ])("is homogeneous for an invalid or unknown token", async (error) => {
    const test = fixture();
    test.revoke.mockRejectedValueOnce(error);

    await expect(test.service.logout("invalid-token")).resolves.toBeUndefined();
  });

  it("does not hide an internal revocation failure", async () => {
    const test = fixture();
    test.revoke.mockRejectedValueOnce(new Error("database unavailable"));

    await expect(test.service.logout("valid-token")).rejects.toThrow(
      "database unavailable"
    );
  });
});
