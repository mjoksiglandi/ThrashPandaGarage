import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const currentSessionId = "c123456789012345678901234";
const otherSessionId = "c223456789012345678901234";
const principal = {
  sessionId: currentSessionId,
  accountId: "account-a",
  clientId: "client-a",
  email: "a@example.test",
};

const mocks = vi.hoisted(() => ({
  requireAccountSession: vi.fn(),
  revokeOwned: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/modules/account-sessions/account-session-guard", () => ({
  requireAccountSession: mocks.requireAccountSession,
}));
vi.mock("@/modules/account-sessions/account-session-management", () => ({
  revokeOwnedAccountSession: mocks.revokeOwned,
}));
vi.mock("@/modules/account-sessions/current-account-session", () => ({
  logoutAccountSessionToken: mocks.logout,
}));

import { POST } from "./route";

function request(options: {
  cookie?: string;
  origin?: string | null;
  forgedBody?: boolean;
} = {}) {
  const headers = new Headers();
  if (options.origin !== null) {
    headers.set("origin", options.origin ?? "http://localhost:3000");
  }
  if (options.cookie) {
    headers.set(
      "cookie",
      `tpg_account_session=${options.cookie}; tpg_client=legacy`
    );
  }
  const body = options.forgedBody
    ? new URLSearchParams({
        accountId: "account-b",
        email: "attacker@example.test",
        role: "ADMIN",
        clientId: "client-b",
        token: "forged",
        digest: "forged",
      })
    : undefined;
  return new NextRequest(
    `http://localhost:3000/api/account-sessions/${otherSessionId}/revoke`,
    {
      method: "POST",
      headers,
      body,
    }
  );
}

function params(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAccountSession.mockResolvedValue(principal);
  mocks.revokeOwned.mockResolvedValue({ revoked: true });
});

describe("POST /api/account-sessions/[sessionId]/revoke", () => {
  it("revokes another session using only the route ID and authenticated principal", async () => {
    const response = await POST(
      request({ cookie: "current-token", forgedBody: true }),
      params(otherSessionId)
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/portal/sessions"
    );
    expect(mocks.revokeOwned).toHaveBeenCalledWith(
      principal,
      otherSessionId
    );
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toBe(
      "private, no-cache, no-store, max-age=0, must-revalidate"
    );
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("uses canonical logout and clears both cookies for the current session", async () => {
    const response = await POST(
      request({ cookie: "current-token" }),
      params(currentSessionId)
    );
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/portal/login"
    );
    expect(mocks.logout).toHaveBeenCalledWith("current-token");
    expect(mocks.revokeOwned).not.toHaveBeenCalled();
    expect(setCookie).toContain("tpg_account_session=");
    expect(setCookie).toContain("tpg_client=");
    expect(setCookie).toContain("Max-Age=0");
  });

  it("never clears the current cookie when revoking another session", async () => {
    const response = await POST(
      request({ cookie: "current-token" }),
      params(otherSessionId)
    );

    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("handles invalid identifiers through the same success redirect", async () => {
    mocks.revokeOwned.mockResolvedValueOnce({ revoked: false });

    const response = await POST(
      request({ cookie: "current-token" }),
      params("invalid")
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/portal/sessions"
    );
    expect(mocks.revokeOwned).toHaveBeenCalledWith(principal, "invalid");
  });

  it("rejects an untrusted origin before authentication", async () => {
    const response = await POST(
      request({ origin: "https://attacker.example" }),
      params(otherSessionId)
    );

    expect(response.status).toBe(403);
    expect(mocks.requireAccountSession).not.toHaveBeenCalled();
    expect(mocks.revokeOwned).not.toHaveBeenCalled();
  });

  it("returns the homogeneous authentication error for an anonymous user", async () => {
    const { AccountAuthenticationRequiredError } = await import(
      "@/modules/account-sessions/account-session-http"
    );
    mocks.requireAccountSession.mockRejectedValueOnce(
      new AccountAuthenticationRequiredError()
    );

    const response = await POST(request(), params(otherSessionId));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Authentication required",
    });
  });

  it("returns a generic internal error without sensitive values", async () => {
    mocks.revokeOwned.mockRejectedValueOnce(
      new Error("tokenHash=secret-digest accessToken=gallery-secret")
    );

    const response = await POST(request(), params(otherSessionId));
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(503);
    expect(serialized).not.toMatch(
      /tokenHash|secret-digest|accessToken|gallery-secret/
    );
  });

  it("still clears both cookies when canonical current-session logout fails", async () => {
    mocks.logout.mockRejectedValueOnce(
      new Error("tokenHash=secret-digest")
    );

    const response = await POST(
      request({ cookie: "current-token" }),
      params(currentSessionId)
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toContain(
      "tpg_account_session="
    );
    expect(response.headers.get("set-cookie")).toContain("tpg_client=");
    expect(JSON.stringify(await response.json())).not.toContain(
      "secret-digest"
    );
  });
});
