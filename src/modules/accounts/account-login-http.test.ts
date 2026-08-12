import { describe, expect, it } from "vitest";
import {
  AccountInactiveError,
  AccountLockedError,
  AccountNotFoundError,
  InvalidCredentialsError,
} from "./account.errors";
import {
  ACCOUNT_LOGIN_REDIRECT,
  ADMIN_LOGIN_REDIRECT,
  INVALID_LOGIN_MESSAGE,
  TEMPORARY_LOGIN_MESSAGE,
  isTrustedLoginOrigin,
  publicLoginError,
} from "./account-login-http";

describe("public account login errors", () => {
  it.each([
    new InvalidCredentialsError(),
    new AccountNotFoundError(),
    new AccountInactiveError(),
    new AccountLockedError(),
  ])("uses one response for every public credential failure", (error) => {
    expect(publicLoginError(error)).toEqual({
      status: 401,
      body: {
        ok: false,
        error: INVALID_LOGIN_MESSAGE,
      },
    });
  });

  it("does not expose infrastructure details", () => {
    const response = publicLoginError(
      new Error('Prisma table "Account" failed with secret-token')
    );

    expect(response).toEqual({
      status: 503,
      body: {
        ok: false,
        error: TEMPORARY_LOGIN_MESSAGE,
      },
    });
    expect(JSON.stringify(response)).not.toContain("Prisma");
    expect(JSON.stringify(response)).not.toContain("secret-token");
  });
});

describe("login HTTP trust boundary", () => {
  it("accepts only the configured application origin", () => {
    const base = {
      configuredBaseUrl: "https://trashpanda.example",
    };

    expect(
      isTrustedLoginOrigin({
        ...base,
        origin: "https://garage.example",
      })
    ).toBe(false);
    expect(
      isTrustedLoginOrigin({
        ...base,
        origin: "https://trashpanda.example",
      })
    ).toBe(true);
    expect(
      isTrustedLoginOrigin({
        ...base,
        origin: "https://attacker.example",
      })
    ).toBe(false);
    expect(
      isTrustedLoginOrigin({ ...base, origin: null })
    ).toBe(false);
  });

  it.each([
    "null",
    "https://trashpanda.example.attacker.test",
    "http://trashpanda.example",
    "https://trashpanda.example:444",
    "https://trashpanda.example/",
    "https://trashpanda.example/login",
    "https://trashpanda.example?origin=forged",
    "https://user@trashpanda.example",
    "https://trashpanda.example, https://attacker.example",
    "not a URL",
  ])("rejects malformed or non-exact Origin %s", (origin) => {
    expect(
      isTrustedLoginOrigin({
        origin,
        configuredBaseUrl: "https://trashpanda.example",
      })
    ).toBe(false);
  });

  it("uses a fixed internal redirect without accepting a next value", () => {
    expect(ACCOUNT_LOGIN_REDIRECT).toBe("/portal");
    expect(ADMIN_LOGIN_REDIRECT).toBe("/admin");
    expect(ACCOUNT_LOGIN_REDIRECT.startsWith("/")).toBe(true);
    expect(ACCOUNT_LOGIN_REDIRECT.startsWith("//")).toBe(false);
  });
});
