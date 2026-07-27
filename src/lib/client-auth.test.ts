import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  compare: vi.fn(),
  cookies: vi.fn(),
  findByEmail: vi.fn(),
  findIdentity: vi.fn(),
  signSessionValue: vi.fn(),
  verifySessionValue: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: { compare: mocks.compare },
}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/env", () => ({
  env: { AUTH_SECRET: "a".repeat(32) },
}));
vi.mock("@/lib/session-token", () => ({
  signSessionValue: mocks.signSessionValue,
  verifySessionValue: mocks.verifySessionValue,
}));
vi.mock("@/modules/clients/client.repository", () => ({
  clientRepository: {
    findByEmail: mocks.findByEmail,
    findIdentity: mocks.findIdentity,
  },
}));

import {
  LEGACY_CLIENT_COOKIE_NAME,
  loginClient,
  resolveLegacyClientId,
} from "./client-auth";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  mocks.findByEmail.mockResolvedValue({
    id: "client-1",
    passwordHash: "legacy-password-hash",
  });
  mocks.compare.mockResolvedValue(true);
  mocks.signSessionValue.mockReturnValue("signed-client-cookie");
  mocks.verifySessionValue.mockReturnValue("client-1");
  mocks.findIdentity.mockResolvedValue({ id: "client-1" });
});

describe("legacy client session compatibility", () => {
  it("emits the existing signed tpg_client cookie after valid credentials", async () => {
    const set = vi.fn();
    mocks.cookies.mockResolvedValue({ set });

    await expect(
      loginClient(" person@example.test ", "password")
    ).resolves.toBe(true);

    expect(mocks.findByEmail).toHaveBeenCalledWith(
      "person@example.test"
    );
    expect(mocks.compare).toHaveBeenCalledWith(
      "password",
      "legacy-password-hash"
    );
    expect(set).toHaveBeenCalledWith(
      LEGACY_CLIENT_COOKIE_NAME,
      "signed-client-cookie",
      {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      }
    );
  });

  it("resolves only a valid signed legacy cookie for an existing client", async () => {
    await expect(
      resolveLegacyClientId("signed-client-cookie")
    ).resolves.toBe("client-1");
    expect(mocks.verifySessionValue).toHaveBeenCalledWith(
      "signed-client-cookie",
      "a".repeat(32)
    );
    expect(mocks.findIdentity).toHaveBeenCalledWith("client-1");
  });

  it("rejects an invalid legacy cookie before database access", async () => {
    mocks.verifySessionValue.mockReturnValueOnce(null);

    await expect(resolveLegacyClientId("tampered")).resolves.toBeNull();
    expect(mocks.findIdentity).not.toHaveBeenCalled();
  });
});
