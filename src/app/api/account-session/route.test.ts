import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
}));

vi.mock("@/modules/account-sessions/account-session-guard", () => ({
  requireAccountSession: mocks.resolve,
}));

import { GET } from "./route";

describe("GET /api/account-session", () => {
  it("returns only the minimal authenticated account principal", async () => {
    mocks.resolve.mockResolvedValueOnce({
      sessionId: "session-internal",
      accountId: "account-1",
      clientId: "client-1",
      email: "person@example.test",
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      account: {
        accountId: "account-1",
        clientId: "client-1",
        email: "person@example.test",
      },
    });
    expect(JSON.stringify(body)).not.toContain("session-internal");
    expect(response.headers.get("cache-control")).toBe(
      "private, no-cache, no-store, max-age=0, must-revalidate"
    );
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("returns the homogeneous 401 contract for no authentication", async () => {
    const { AccountAuthenticationRequiredError } = await import(
      "@/modules/account-sessions/account-session-http"
    );
    mocks.resolve.mockRejectedValueOnce(
      new AccountAuthenticationRequiredError()
    );

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Authentication required",
    });
  });

  it("does not expose internal session failures", async () => {
    mocks.resolve.mockRejectedValueOnce(
      new Error("tokenHash=secret-digest")
    );

    const response = await GET();
    const body = JSON.stringify(await response.json());

    expect(response.status).toBe(503);
    expect(body).not.toContain("tokenHash");
    expect(body).not.toContain("secret-digest");
  });
});
