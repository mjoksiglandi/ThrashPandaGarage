import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeAccountEmail } from "@/modules/accounts/account-email";

const mocks = vi.hoisted(() => ({
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
}));
vi.mock("./password-recovery-rate-limit", () => ({
  checkPasswordRecoveryRateLimit: mocks.checkRateLimit,
}));

import { requestAccountPasswordRecovery } from "./password-recovery";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkRateLimit.mockReturnValue(true);
  mocks.serviceRequest.mockResolvedValue(undefined);
});

describe("requestAccountPasswordRecovery", () => {
  it("applies both rate limits before any account lookup", async () => {
    mocks.checkRateLimit.mockReturnValueOnce(false);
    const email = normalizeAccountEmail("unknown@example.test");

    await requestAccountPasswordRecovery({
      email,
      origin: "203.0.113.5",
    });

    expect(mocks.checkRateLimit).toHaveBeenCalledWith({
      email,
      origin: "203.0.113.5",
    });
    expect(mocks.serviceRequest).not.toHaveBeenCalled();
  });

  it("passes the normalized email to the service after rate limiting", async () => {
    const email = normalizeAccountEmail("person@example.test");
    await requestAccountPasswordRecovery({
      email,
      origin: "203.0.113.5",
    });

    expect(mocks.checkRateLimit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.serviceRequest.mock.invocationCallOrder[0]
    );
    expect(mocks.serviceRequest).toHaveBeenCalledWith(email);
  });

  it("sanitizes internal failures", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.serviceRequest.mockRejectedValueOnce(
      new Error("person@example.test opaque-secret tokenHash")
    );

    await requestAccountPasswordRecovery({
      email: normalizeAccountEmail("person@example.test"),
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
});
