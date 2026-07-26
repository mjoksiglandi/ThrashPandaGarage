import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvalidTokenError } from "@/modules/accounts/secure-token";

const mocks = vi.hoisted(() => ({
  digest: vi.fn(),
  findByTokenHash: vi.fn(),
  accept: vi.fn(),
  createAcceptanceService: vi.fn(),
  hash: vi.fn(),
  compare: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("bcryptjs", () => ({
  default: {
    hash: mocks.hash,
    compare: mocks.compare,
  },
}));
vi.mock("@/modules/accounts/account-service.repository", () => ({
  createPrismaAccountServiceStore: () => ({ transaction: vi.fn() }),
}));
vi.mock("@/modules/accounts/secure-token", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/modules/accounts/secure-token")>();
  return {
    ...original,
    sha256TokenHasher: {
      digest: mocks.digest,
      verify: vi.fn(),
    },
  };
});
vi.mock("./invitation.repository", () => ({
  invitationRepository: {
    findByTokenHash: mocks.findByTokenHash,
  },
}));
vi.mock("./invitation.service", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("./invitation.service")>();
  mocks.createAcceptanceService.mockReturnValue({
    accept: mocks.accept,
  });
  return {
    ...original,
    createInvitationAcceptanceService: mocks.createAcceptanceService,
  };
});

import {
  acceptAccountInvitation,
  isInvitationAvailable,
} from "./invitation-acceptance";

const now = new Date("2026-07-25T12:00:00.000Z");
const acceptanceDependencies =
  mocks.createAcceptanceService.mock.calls[0][0];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.digest.mockReturnValue("a".repeat(64));
  mocks.findByTokenHash.mockResolvedValue({
    acceptedAt: null,
    revokedAt: null,
    expiresAt: new Date(now.getTime() + 60_000),
    account: { status: "INVITED" },
  });
});

describe("public invitation acceptance boundary", () => {
  it("exposes only whether a valid invitation is available", async () => {
    await expect(isInvitationAvailable("A".repeat(43), now)).resolves.toBe(true);
    expect(mocks.findByTokenHash).toHaveBeenCalledWith("a".repeat(64));
  });

  it.each([
    {
      acceptedAt: now,
      revokedAt: null,
      expiresAt: new Date(now.getTime() + 60_000),
      account: { status: "ACTIVE" },
    },
    {
      acceptedAt: null,
      revokedAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
      account: { status: "INVITED" },
    },
    {
      acceptedAt: null,
      revokedAt: null,
      expiresAt: now,
      account: { status: "INVITED" },
    },
  ])("returns the same unavailable state for terminal invitations", async (invitation) => {
    mocks.findByTokenHash.mockResolvedValueOnce(invitation);

    await expect(isInvitationAvailable("A".repeat(43), now)).resolves.toBe(false);
  });

  it("uses the same persistence lookup shape for malformed tokens", async () => {
    mocks.digest.mockImplementationOnce(() => {
      throw new InvalidTokenError();
    });

    await expect(isInvitationAvailable("malformed", now)).resolves.toBe(false);
    expect(mocks.findByTokenHash).toHaveBeenCalledWith("0".repeat(64));
  });

  it("delegates mutation to the transactional acceptance service", async () => {
    const input = {
      token: "A".repeat(43),
      password: "a-secure-password",
    };
    mocks.accept.mockResolvedValueOnce({ status: "ACTIVE" });

    await expect(acceptAccountInvitation(input)).resolves.toEqual({
      status: "ACTIVE",
    });
    expect(mocks.accept).toHaveBeenCalledWith(input);
  });

  it("uses bcrypt cost 12 without transforming the password", async () => {
    const password = "  exact password  ";
    mocks.hash.mockResolvedValueOnce("bcrypt-hash");

    await expect(
      acceptanceDependencies.passwordHasher.hash(password)
    ).resolves.toBe(
      "bcrypt-hash"
    );
    expect(mocks.hash).toHaveBeenCalledWith(password, 12);
  });
});
