import { describe, expect, it, vi } from "vitest";
import type {
  AccountServiceStore,
  AccountServiceTransaction,
  InvitationWithAccountRecord,
} from "@/modules/accounts/account-service.repository";
import { InvalidCredentialsError } from "@/modules/accounts/account.errors";
import { sha256TokenHasher } from "@/modules/accounts/secure-token";
import {
  InvalidPasswordHashError,
  InvitationNotFoundError,
  PasswordHashingError,
} from "./invitation.errors";
import {
  ACCEPTANCE_PASSWORD_MAX_BYTES,
  ACCEPTANCE_PASSWORD_MIN_LENGTH,
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
  const invitation: InvitationWithAccountRecord = {
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
  };
  const lockInvitationByTokenHash = vi.fn(async () => invitation);
  const transaction = {
    lockInvitationByTokenHash,
    updateAccount,
    acceptInvitation,
    revokePendingInvitations: vi.fn(async () => 0),
  } as unknown as AccountServiceTransaction;
  const store: AccountServiceStore = {
    findAuthenticationAccountByEmail: async () => null,
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
    invitation,
    passwordHasher,
    lockInvitationByTokenHash,
    updateAccount,
    acceptInvitation,
  };
}

describe("invitation acceptance password boundary", () => {
  it("performs the same locked lookup for a malformed token before rejecting it", async () => {
    const fixture = createFixture(async () => "valid-hash");

    await expect(
      fixture.service.accept({
        token: "malformed",
        password: "valid-password",
      })
    ).rejects.toBeInstanceOf(InvitationNotFoundError);
    expect(fixture.lockInvitationByTokenHash).toHaveBeenCalledWith(
      "0".repeat(64)
    );
    expect(fixture.passwordHasher.hash).not.toHaveBeenCalled();
    expect(fixture.updateAccount).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: "already accepted",
      invitation: { acceptedAt: now },
    },
    {
      label: "account already active",
      invitation: {
        account: {
          id: "account-1",
          email: "account@example.test",
          status: "ACTIVE" as const,
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: null,
        },
      },
    },
  ])("does not hash or overwrite for $label", async ({ invitation }) => {
    const fixture = createFixture(async () => "replacement-hash");
    fixture.lockInvitationByTokenHash.mockResolvedValueOnce({
      ...fixture.invitation,
      ...invitation,
    });

    await expect(
      fixture.service.accept({
        token: validToken,
        password: "valid-password",
      })
    ).rejects.toThrow();
    expect(fixture.passwordHasher.hash).not.toHaveBeenCalled();
    expect(fixture.updateAccount).not.toHaveBeenCalled();
    expect(fixture.acceptInvitation).not.toHaveBeenCalled();
  });

  it.each([
    ["empty", ""],
    ["whitespace-only", "   "],
    ["too short", "p".repeat(ACCEPTANCE_PASSWORD_MIN_LENGTH - 1)],
  ])("rejects a %s password before hashing", async (_label, password) => {
    const fixture = createFixture(async () => "valid-hash");

    await expect(
      fixture.service.accept({ token: validToken, password })
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(fixture.passwordHasher.hash).not.toHaveBeenCalled();
    expect(fixture.updateAccount).not.toHaveBeenCalled();
  });

  it("accepts passwords at both final length boundaries without modifying them", async () => {
    const fixture = createFixture(async () => "valid-hash");
    const passwords = [
      "p".repeat(ACCEPTANCE_PASSWORD_MIN_LENGTH),
      "p".repeat(ACCEPTANCE_PASSWORD_MAX_LENGTH),
    ];

    for (const password of passwords) {
      await fixture.service.accept({ token: validToken, password });
      expect(fixture.passwordHasher.hash).toHaveBeenLastCalledWith(password);
    }

    expect(fixture.updateAccount).toHaveBeenCalledWith(
      "account-1",
      expect.objectContaining({ passwordHash: "valid-hash", status: "ACTIVE" })
    );
  });

  it("rejects a password over the final maximum", async () => {
    const fixture = createFixture(async () => "valid-hash");
    const password = "p".repeat(ACCEPTANCE_PASSWORD_MAX_LENGTH + 1);

    await expect(
      fixture.service.accept({ token: validToken, password })
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(fixture.passwordHasher.hash).not.toHaveBeenCalled();
    expect(fixture.updateAccount).not.toHaveBeenCalled();
  });

  it("rejects a multibyte password beyond bcrypt's byte boundary", async () => {
    const fixture = createFixture(async () => "valid-hash");
    const password = "é".repeat(
      Math.floor(ACCEPTANCE_PASSWORD_MAX_BYTES / 2) + 1
    );

    await expect(
      fixture.service.accept({ token: validToken, password })
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(fixture.passwordHasher.hash).not.toHaveBeenCalled();
  });

  it("accepts a multibyte password at exactly 72 UTF-8 bytes", async () => {
    const fixture = createFixture(async () => "valid-hash");
    const password = "é".repeat(ACCEPTANCE_PASSWORD_MAX_BYTES / 2);

    expect(Buffer.byteLength(password, "utf8")).toBe(
      ACCEPTANCE_PASSWORD_MAX_BYTES
    );
    await fixture.service.accept({ token: validToken, password });
    expect(fixture.passwordHasher.hash).toHaveBeenCalledWith(password);
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
