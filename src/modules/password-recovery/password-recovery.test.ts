import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  InvalidAccountEmailError,
} from "@/modules/accounts/account.errors";

const mocks = vi.hoisted(() => ({
  parseEmail: vi.fn(),
  checkRateLimit: vi.fn(),
  serviceRequest: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/modules/accounts/secure-token", () => ({
  cryptoTokenGenerator: {},
  sha256TokenHasher: {},
}));
vi.mock("@/modules/mail/password-recovery-mail", () => ({
  sendPasswordRecoveryEmail: vi.fn(),
}));
vi.mock("./password-recovery.repository", () => ({
  createPrismaPasswordRecoveryStore: vi.fn(() => ({})),
}));
vi.mock("./password-recovery.service", () => ({
  PASSWORD_RECOVERY_DURATION_MS: 60 * 60 * 1000,
  createPasswordRecoveryService: vi.fn(() => ({
    request: mocks.serviceRequest,
  })),
  parsePasswordRecoveryEmail: mocks.parseEmail,
}));
vi.mock("./password-recovery-rate-limit", () => ({
  checkPasswordRecoveryRateLimit: mocks.checkRateLimit,
}));

import { requestAccountPasswordRecovery } from "./password-recovery";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.parseEmail.mockReturnValue("person@example.test");
  mocks.checkRateLimit.mockReturnValue(true);
  mocks.serviceRequest.mockResolvedValue(undefined);
});

describe("requestAccountPasswordRecovery", () => {
  it("applies both rate limits before any account lookup", async () => {
    mocks.checkRateLimit.mockReturnValueOnce(false);

    await requestAccountPasswordRecovery({
      email: "unknown@example.test",
      origin: "203.0.113.5",
    });

    expect(mocks.checkRateLimit).toHaveBeenCalledWith({
      email: "person@example.test",
      origin: "203.0.113.5",
    });
    expect(mocks.serviceRequest).not.toHaveBeenCalled();
  });

  it("passes the canonical email to the service after rate limiting", async () => {
    await requestAccountPasswordRecovery({
      email: " Person@Example.TEST ",
      origin: "203.0.113.5",
    });

    expect(mocks.checkRateLimit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.serviceRequest.mock.invocationCallOrder[0]
    );
    expect(mocks.serviceRequest).toHaveBeenCalledWith(
      "person@example.test"
    );
  });

  it("sanitizes internal failures", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.serviceRequest.mockRejectedValueOnce(
      new Error("person@example.test opaque-secret tokenHash")
    );

    await requestAccountPasswordRecovery({
      email: "person@example.test",
      origin: "203.0.113.5",
    });

    expect(consoleError).toHaveBeenCalledWith(
      "Password recovery request failed"
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      "opaque-secret"
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      "person@example.test"
    );
    consoleError.mockRestore();
  });

  it("lets validation errors reach the route without consuming rate limit", async () => {
    mocks.parseEmail.mockImplementationOnce(() => {
      throw new InvalidAccountEmailError();
    });

    await expect(
      requestAccountPasswordRecovery({
        email: "invalid",
        origin: "203.0.113.5",
      })
    ).rejects.toBeInstanceOf(InvalidAccountEmailError);
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
  });
});
