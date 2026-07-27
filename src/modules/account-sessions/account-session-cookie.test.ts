import { describe, expect, it } from "vitest";
import {
  ACCOUNT_SESSION_COOKIE_NAME,
  accountSessionCookie,
  clearedAccountSessionCookie,
} from "./account-session-cookie";

const now = new Date("2026-07-26T12:00:00.000Z");
const expiresAt = new Date("2026-07-26T13:00:00.000Z");

describe("account session cookie policy", () => {
  it("contains only the opaque token and production-safe attributes", () => {
    const cookie = accountSessionCookie(
      "opaque-token-only",
      expiresAt,
      { now, secure: true }
    );

    expect(cookie).toEqual({
      name: ACCOUNT_SESSION_COOKIE_NAME,
      value: "opaque-token-only",
      options: {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        expires: expiresAt,
        maxAge: 3600,
      },
    });
    expect(cookie.value).not.toContain("{");
    expect(cookie.value).not.toContain("@");
  });

  it("allows an insecure transport cookie only when explicitly configured for local development", () => {
    expect(
      accountSessionCookie("opaque-token", expiresAt, {
        now,
        secure: false,
      }).options.secure
    ).toBe(false);
  });

  it("refuses to emit an already expired cookie", () => {
    expect(() =>
      accountSessionCookie("opaque-token", now, { now })
    ).toThrow("Cannot set an expired account session cookie");
  });

  it("clears the cookie with the same security and path attributes", () => {
    expect(
      clearedAccountSessionCookie({ secure: true })
    ).toEqual({
      name: ACCOUNT_SESSION_COOKIE_NAME,
      value: "",
      options: {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        expires: new Date(0),
        maxAge: 0,
      },
    });
  });

  it("clears the development cookie without adding Secure", () => {
    expect(
      clearedAccountSessionCookie({ secure: false }).options
    ).toMatchObject({
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      expires: new Date(0),
      maxAge: 0,
    });
  });
});
