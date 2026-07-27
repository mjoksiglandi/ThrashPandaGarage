import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvalidCredentialsError } from "@/modules/accounts/account.errors";
import {
  PasswordResetHashingError,
  PasswordResetUnavailableError,
} from "@/modules/password-recovery/password-reset.service";

const mocks = vi.hoisted(() => ({
  reset: vi.fn(),
}));

vi.mock("@/modules/password-recovery/password-reset", () => {
  class PasswordResetRateLimitedError extends Error {}
  return {
    PasswordResetRateLimitedError,
    resetAccountPassword: mocks.reset,
  };
});

import {
  PasswordResetRateLimitedError,
} from "@/modules/password-recovery/password-reset";
import {
  PASSWORD_RESET_CACHE_CONTROL,
  PASSWORD_RESET_PASSWORD_MESSAGE,
  PASSWORD_RESET_SUCCESS_MESSAGE,
  PASSWORD_RESET_TEMPORARY_MESSAGE,
  PASSWORD_RESET_UNAVAILABLE_MESSAGE,
  POST,
} from "./route";

const token = "A".repeat(43);
const password = "a-secure-password";

function request(body: string) {
  return new NextRequest(
    "http://localhost:3000/api/account-password-reset",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.9, 10.0.0.1",
      },
      body,
    }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.reset.mockResolvedValue(undefined);
});

describe("POST /api/account-password-reset", () => {
  it("returns a non-cacheable success without creating a cookie", async () => {
    const response = await POST(
      request(JSON.stringify({ token, password }))
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      message: PASSWORD_RESET_SUCCESS_MESSAGE,
    });
    expect(response.headers.get("cache-control")).toBe(
      PASSWORD_RESET_CACHE_CONTROL
    );
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("content-type")).toContain(
      "application/json"
    );
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mocks.reset).toHaveBeenCalledWith({
      token,
      password,
      origin: "203.0.113.9",
    });
  });

  it("returns 400 for invalid JSON without calling the service", async () => {
    const response = await POST(request("{"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      message: PASSWORD_RESET_UNAVAILABLE_MESSAGE,
    });
    expect(mocks.reset).not.toHaveBeenCalled();
  });

  it.each([
    ["missing token", { password }],
    ["token with wrong type", { token: 42, password }],
  ])("uses the generic contract for %s", async (_label, body) => {
    mocks.reset.mockRejectedValueOnce(
      new PasswordResetUnavailableError()
    );
    const response = await POST(request(JSON.stringify(body)));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      message: PASSWORD_RESET_UNAVAILABLE_MESSAGE,
    });
  });

  it.each([
    ["missing password", { token }],
    ["password with wrong type", { token, password: 42 }],
    ["password beyond 72 bytes", { token, password: "a".repeat(73) }],
  ])("returns explicit password requirements for %s", async (_label, body) => {
    mocks.reset.mockRejectedValueOnce(new InvalidCredentialsError());
    const response = await POST(request(JSON.stringify(body)));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      message: PASSWORD_RESET_PASSWORD_MESSAGE,
    });
  });

  it("keeps every unusable token state exactly equal", async () => {
    const responses: string[] = [];
    for (const _state of [
      "unknown",
      "expired",
      "revoked",
      "consumed",
      "inactive",
      "race-lost",
    ]) {
      mocks.reset.mockRejectedValueOnce(
        new PasswordResetUnavailableError()
      );
      const response = await POST(
        request(JSON.stringify({ token, password }))
      );
      responses.push(
        JSON.stringify({
          status: response.status,
          cacheControl: response.headers.get("cache-control"),
          setCookie: response.headers.get("set-cookie"),
          body: await response.json(),
        })
      );
    }

    expect(new Set(responses)).toHaveLength(1);
    expect(responses[0]).not.toContain(token);
    expect(responses[0]).not.toContain(password);
  });

  it.each([
    [new PasswordResetRateLimitedError(), 429],
    [new PasswordResetHashingError(), 503],
  ])("maps expected temporary failures safely", async (error, status) => {
    mocks.reset.mockRejectedValueOnce(error);
    const response = await POST(
      request(JSON.stringify({ token, password }))
    );

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({
      ok: false,
      message: PASSWORD_RESET_TEMPORARY_MESSAGE,
    });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("hides internal details from the response and sanitized log", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.reset.mockRejectedValueOnce(
      new Error(`UPDATE password=${password} token=${token}`)
    );

    const response = await POST(
      request(JSON.stringify({ token, password }))
    );
    const publicResult = JSON.stringify(await response.json());

    expect(response.status).toBe(503);
    expect(publicResult).not.toContain(token);
    expect(publicResult).not.toContain(password);
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(token);
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(password);
    consoleError.mockRestore();
  });
});
