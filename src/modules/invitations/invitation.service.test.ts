import { describe, expect, it, vi } from "vitest";
import type {
  AccountServiceStore,
  AccountServiceTransaction,
} from "@/modules/accounts/account-service.repository";
import { InvalidCredentialsError } from "@/modules/accounts/account.errors";
import { sha256TokenHasher } from "@/modules/accounts/secure-token";
import {
  InvalidPasswordHashError,
  PasswordHashingError,
} from "./invitation.errors";
import {
  ACCEPTANCE_PASSWORD_MAX_LENGTH,
  createInvitationService,
  PASSWORD_HASH_MAX_LENGTH,
} from "./invitation.service";

const now = new Date("2026-07-25T12:00:00.000Z");
const validToken = "A".repeat(43);

function createFixture(hash: (password: string) => Promise<string>) {
  const updateAccount = vi.fn(async () => ({
    id: "account-1",
    email: "account@example.test",
    status: "ACTIVE" as const,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
  }));
  const acceptInvitation = vi.fn(async () => undefined);
  const transaction = {
    lockInvitationByTokenHash: vi.fn(async () => ({
      id: "invitation-1",
      accountId: "account-1",
      tokenHash: sha256TokenHasher.digest(validToken),
      expiresAt: new Date(now.getTime() + 60_000),
      acceptedAt: null,
      revokedAt: null,
      createdAt: now,
      account: {
        id: "account-1",
        email: "account@example.test",
        status: "INVITED" as const,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: null,
      },
    })),
    updateAccount,
    acceptInvitation,
    revokePendingInvitations: vi.fn(async () => 0),
  } as unknown as AccountServiceTransaction;
  const store: AccountServiceStore = {
    transaction: (work) => work(transaction),
  };
  const passwordHasher = {
    hash: vi.fn(hash),
    verify: vi.fn(async () => false),
  };
  const service = createInvitationService({
    store,
    clock: { now: () => new Date(now) },
    tokenGenerator: { generate: () => validToken },
    tokenHasher: sha256TokenHasher,
    passwordHasher,
    invitationDurationMs: 60_000,
  });

  return {
    service,
    passwordHasher,
    updateAccount,
    acceptInvitation,
  };
}

describe("invitation acceptance password boundary", () => {
  it.each([
    ["empty", ""],
    ["whitespace-only", "   "],
  ])("rejects a %s password before hashing", async (_label, password) => {
    const fixture = createFixture(async () => "valid-hash");

    await expect(
      fixture.service.accept({ token: validToken, password })
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(fixture.passwordHasher.hash).not.toHaveBeenCalled();
    expect(fixture.updateAccount).not.toHaveBeenCalled();
  });

  it("accepts a password at the temporary maximum without modifying it", async () => {
    const fixture = createFixture(async () => "valid-hash");
    const password = "p".repeat(ACCEPTANCE_PASSWORD_MAX_LENGTH);

    await fixture.service.accept({ token: validToken, password });

    expect(fixture.passwordHasher.hash).toHaveBeenCalledWith(password);
    expect(fixture.updateAccount).toHaveBeenCalledWith(
      "account-1",
      expect.objectContaining({ passwordHash: "valid-hash", status: "ACTIVE" })
    );
  });

  it("rejects a password over the temporary maximum", async () => {
    const fixture = createFixture(async () => "valid-hash");
    const password = "p".repeat(ACCEPTANCE_PASSWORD_MAX_LENGTH + 1);

    await expect(
      fixture.service.accept({ token: validToken, password })
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(fixture.passwordHasher.hash).not.toHaveBeenCalled();
    expect(fixture.updateAccount).not.toHaveBeenCalled();
  });

  it.each([
    ["empty", ""],
    ["whitespace-only", "   "],
    ["overlong", "h".repeat(PASSWORD_HASH_MAX_LENGTH + 1)],
  ])("rejects a %s password hash before activation", async (_label, hash) => {
    const fixture = createFixture(async () => hash);

    await expect(
      fixture.service.accept({ token: validToken, password: "valid-password" })
    ).rejects.toBeInstanceOf(InvalidPasswordHashError);
    expect(fixture.updateAccount).not.toHaveBeenCalled();
    expect(fixture.acceptInvitation).not.toHaveBeenCalled();
  });

  it("maps a hasher exception to a stable domain error", async () => {
    const fixture = createFixture(async () => {
      throw new Error("secret implementation failure");
    });

    await expect(
      fixture.service.accept({ token: validToken, password: "valid-password" })
    ).rejects.toBeInstanceOf(PasswordHashingError);
    expect(fixture.updateAccount).not.toHaveBeenCalled();
    expect(fixture.acceptInvitation).not.toHaveBeenCalled();
  });

  it("activates the account for a valid password and hash", async () => {
    const fixture = createFixture(async () => "valid-hash");

    await expect(
      fixture.service.accept({ token: validToken, password: "valid-password" })
    ).resolves.toMatchObject({
      invitationId: "invitation-1",
      accountId: "account-1",
      status: "ACTIVE",
    });
    expect(fixture.updateAccount).toHaveBeenCalledOnce();
    expect(fixture.acceptInvitation).toHaveBeenCalledOnce();
  });
});
