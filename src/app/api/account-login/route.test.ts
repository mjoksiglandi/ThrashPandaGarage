import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvalidCredentialsError } from "@/modules/accounts/account.errors";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
}));

vi.mock("@/modules/accounts/account-login", () => ({
  authenticateAccount: mocks.authenticate,
}));

import { POST } from "./route";

function loginRequest(
  options: {
    email?: string;
    password?: string;
    origin?: string | null;
    requestUrl?: string;
  } = {}
) {
  const formData = new FormData();
  formData.set("email", options.email ?? "person@example.test");
  formData.set("password", options.password ?? "valid password");
  const headers = new Headers();
  if (options.origin !== null) {
    headers.set(
      "origin",
      options.origin ?? "http://localhost:3000"
    );
  }
  return new NextRequest(
    options.requestUrl ??
      "http://localhost:3000/api/account-login",
    {
      method: "POST",
      headers,
      body: formData,
    }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
});

describe("POST /api/account-login", () => {
  it("emits the opaque session cookie only after a successful login", async () => {
    mocks.authenticate.mockResolvedValueOnce({
      token: "opaque-token-value",
      expiresAt: new Date(Date.now() + 60_000),
    });

    const response = await POST(loginRequest());
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/"
    );
    expect(await response.text()).not.toContain("opaque-token-value");
    expect(setCookie).toContain(
      "tpg_account_session=opaque-token-value"
    );
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=lax");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toMatch(/Max-Age=\d+/);
    expect(response.headers.get("cache-control")).toBe(
      "private, no-cache, no-store, max-age=0, must-revalidate"
    );
  });

  it("does not derive the success redirect from a hostile request URL", async () => {
    mocks.authenticate.mockResolvedValueOnce({
      token: "opaque-token-value",
      expiresAt: new Date(Date.now() + 60_000),
    });

    const response = await POST(
      loginRequest({
        origin: "http://localhost:3000",
        requestUrl: "https://attacker.example/api/account-login",
      })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/"
    );
  });

  it("returns the same public body without a cookie for invalid credentials", async () => {
    mocks.authenticate.mockRejectedValueOnce(
      new InvalidCredentialsError()
    );

    const response = await POST(loginRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Correo electrónico o contraseña incorrectos.",
    });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects a cross-site or missing Origin before reading credentials", async () => {
    for (const origin of ["https://attacker.example", null]) {
      const response = await POST(loginRequest({ origin }));
      expect(response.status).toBe(403);
      expect(response.headers.get("set-cookie")).toBeNull();
    }
    expect(mocks.authenticate).not.toHaveBeenCalled();
  });

  it("does not expose internal failures, credentials, or tokens", async () => {
    mocks.authenticate.mockRejectedValueOnce(
      new Error("SELECT passwordHash FROM Account; secret-token")
    );

    const response = await POST(
      loginRequest({
        email: "sensitive@example.test",
        password: "secret password",
      })
    );
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(503);
    expect(serialized).toContain("No pudimos iniciar sesión");
    expect(serialized).not.toContain("passwordHash");
    expect(serialized).not.toContain("sensitive@example.test");
    expect(serialized).not.toContain("secret password");
    expect(serialized).not.toContain("secret-token");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
