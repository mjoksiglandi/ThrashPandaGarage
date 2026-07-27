import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  InvalidAccountEmailError,
} from "@/modules/accounts/account.errors";

const mocks = vi.hoisted(() => ({
  requestRecovery: vi.fn(),
}));

vi.mock("@/modules/password-recovery/password-recovery", () => ({
  requestAccountPasswordRecovery: mocks.requestRecovery,
}));

import {
  PASSWORD_RECOVERY_CACHE_CONTROL,
  PASSWORD_RECOVERY_PUBLIC_MESSAGE,
  POST,
} from "./route";

function request(
  body: string,
  headers: Record<string, string> = {
    "content-type": "application/json",
    "x-forwarded-for": "203.0.113.5, 10.0.0.1",
  }
) {
  return new NextRequest(
    "http://localhost:3000/api/account-password-recovery",
    { method: "POST", headers, body }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requestRecovery.mockResolvedValue(undefined);
});

describe("POST /api/account-password-recovery", () => {
  it("returns a generic non-cacheable response and passes the first client origin", async () => {
    const response = await POST(
      request(JSON.stringify({ email: "Person@Example.TEST" }))
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      message: PASSWORD_RECOVERY_PUBLIC_MESSAGE,
    });
    expect(response.headers.get("content-type")).toContain(
      "application/json"
    );
    expect(response.headers.get("cache-control")).toBe(
      PASSWORD_RECOVERY_CACHE_CONTROL
    );
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(mocks.requestRecovery).toHaveBeenCalledWith({
      email: "Person@Example.TEST",
      origin: "203.0.113.5",
    });
  });

  it("keeps expected and internal outcomes publicly indistinguishable", async () => {
    const responses: Array<{
      status: number;
      contentType: string | null;
      cacheControl: string | null;
      body: unknown;
    }> = [];
    for (const outcome of [
      undefined,
      undefined,
      undefined,
      undefined,
      new Error("SELECT tokenHash; opaque-secret"),
    ]) {
      if (outcome instanceof Error) {
        mocks.requestRecovery.mockRejectedValueOnce(outcome);
      } else {
        mocks.requestRecovery.mockResolvedValueOnce(outcome);
      }
      const response = await POST(
        request(JSON.stringify({ email: "person@example.test" }))
      );
      responses.push({
        status: response.status,
        contentType: response.headers.get("content-type"),
        cacheControl: response.headers.get("cache-control"),
        body: await response.json(),
      });
    }

    expect(responses.every((value) => {
      return JSON.stringify(value) === JSON.stringify(responses[0]);
    })).toBe(true);
    expect(JSON.stringify(responses)).not.toContain("opaque-secret");
    expect(JSON.stringify(responses)).not.toContain("tokenHash");
  });

  it("returns 400 for invalid JSON without calling the service", async () => {
    const response = await POST(request("{"));
    expect(response.status).toBe(400);
    expect(mocks.requestRecovery).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid email", async () => {
    mocks.requestRecovery.mockRejectedValueOnce(
      new InvalidAccountEmailError()
    );
    const response = await POST(
      request(JSON.stringify({ email: "not-an-email" }))
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      error: "Ingresa un correo electrónico válido.",
    });
  });

  it("never returns a token or recovery link", async () => {
    const response = await POST(
      request(JSON.stringify({ email: "person@example.test" }))
    );
    const body = JSON.stringify(await response.json());
    expect(body).not.toContain("token");
    expect(body).not.toContain("password-reset");
    expect(body).not.toContain("person@example.test");
  });
});
