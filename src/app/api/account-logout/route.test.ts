import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
}));

vi.mock("@/modules/account-sessions/current-account-session", () => ({
  logoutAccountSessionToken: mocks.logout,
}));

import { POST } from "./route";

function logoutRequest(options: {
  cookie?: string;
  legacyCookie?: string;
  origin?: string | null;
} = {}) {
  const headers = new Headers();
  if (options.origin !== null) {
    headers.set("origin", options.origin ?? "http://localhost:3000");
  }
  const cookieHeader = [
    options.cookie === undefined
      ? null
      : `tpg_account_session=${options.cookie}`,
    options.legacyCookie === undefined
      ? null
      : `tpg_client=${options.legacyCookie}`,
  ].filter(Boolean).join("; ");
  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }
  return new NextRequest("http://localhost:3000/api/account-logout", {
    method: "POST",
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
});

describe("POST /api/account-logout", () => {
  it("revokes the current session and always expires its cookie", async () => {
    const response = await POST(
      logoutRequest({ cookie: "valid-session-token" })
    );
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(204);
    expect(mocks.logout).toHaveBeenCalledWith("valid-session-token");
    expect(setCookie).toContain("tpg_account_session=");
    expect(setCookie).toContain("Max-Age=0");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=lax");
    expect(response.headers.get("cache-control")).toBe(
      "private, no-cache, no-store, max-age=0, must-revalidate"
    );
  });

  it("also expires the transition legacy cookie to prevent post-logout fallback", async () => {
    const response = await POST(
      logoutRequest({
        cookie: "valid-session-token",
        legacyCookie: "valid-legacy-cookie",
      })
    );
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(204);
    expect(setCookie).toContain("tpg_account_session=");
    expect(setCookie).toContain("tpg_client=");
  });

  it("does not add Secure when clearing cookies in development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const response = await POST(
      logoutRequest({
        cookie: "valid-session-token",
        legacyCookie: "valid-legacy-cookie",
      })
    );

    expect(response.headers.get("set-cookie")).not.toContain("Secure");
  });

  it("is idempotent and homogeneous without a cookie", async () => {
    const response = await POST(logoutRequest());

    expect(response.status).toBe(204);
    expect(mocks.logout).toHaveBeenCalledWith(undefined);
    expect(response.headers.get("set-cookie")).toContain(
      "tpg_account_session="
    );
  });

  it("still clears the cookie when persistence fails internally", async () => {
    mocks.logout.mockRejectedValueOnce(
      new Error("UPDATE AccountSession tokenHash=secret")
    );

    const response = await POST(
      logoutRequest({ cookie: "valid-session-token" })
    );
    const body = JSON.stringify(await response.json());

    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toContain(
      "tpg_account_session="
    );
    expect(body).not.toContain("tokenHash");
    expect(body).not.toContain("secret");
  });

  it("rejects a cross-site request without attempting revocation", async () => {
    const response = await POST(
      logoutRequest({
        cookie: "valid-session-token",
        origin: "https://attacker.example",
      })
    );

    expect(response.status).toBe(403);
    expect(mocks.logout).not.toHaveBeenCalled();
  });
});
