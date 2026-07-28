import { describe, expect, it } from "vitest";
import {
  ACCOUNT_AUTHENTICATION_MESSAGE,
  AccountAuthenticationRequiredError,
  publicAccountSessionError,
  requireAuthenticatedAccount,
} from "./account-session-http";

const principal = {
  accountId: "account-1",
  clientId: "client-1",
  email: "person@example.test",
};

describe("account session HTTP contract", () => {
  it("returns the principal only for an authenticated resolution", () => {
    expect(
      requireAuthenticatedAccount({
        kind: "authenticated",
        principal,
      })
    ).toEqual(principal);
  });

  it("uses 401 for missing or invalid authentication", () => {
    expect(() =>
      requireAuthenticatedAccount({ kind: "unauthenticated" })
    ).toThrow(AccountAuthenticationRequiredError);
    expect(
      publicAccountSessionError(
        new AccountAuthenticationRequiredError()
      )
    ).toEqual({
      status: 401,
      body: {
        ok: false,
        error: ACCOUNT_AUTHENTICATION_MESSAGE,
      },
    });
  });

  it("keeps unexpected internal failures generic and distinct", () => {
    const response = publicAccountSessionError(
      new Error("SELECT tokenHash secret-digest")
    );

    expect(response.status).toBe(503);
    expect(JSON.stringify(response.body)).not.toContain("tokenHash");
    expect(JSON.stringify(response.body)).not.toContain("secret-digest");
  });
});
