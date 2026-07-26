import { describe, expect, it } from "vitest";
import {
  AccountInactiveError,
  AccountLockedError,
  InvalidCredentialsError,
} from "./account.errors";
import {
  cryptoTokenGenerator,
  InvalidTokenError,
  sha256TokenHasher,
} from "./secure-token";
import {
  AccountSessionExpiredError,
  AccountSessionNotFoundError,
  AccountSessionRevokedError,
} from "@/modules/account-sessions/account-session.errors";
import {
  InvitationExpiredError,
  InvalidPasswordHashError,
  InvitationNotFoundError,
  InvitationRevokedError,
  PasswordHashingError,
} from "@/modules/invitations/invitation.errors";

const validToken = "A".repeat(43);
const otherValidToken = "B".repeat(43);

describe("secure token primitives", () => {
  it("generates unpredictable 256-bit opaque tokens", () => {
    const first = cryptoTokenGenerator.generate();
    const second = cryptoTokenGenerator.generate();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
  });

  it("accepts a 43-character base64url token and a lowercase SHA-256 digest", () => {
    const digest = sha256TokenHasher.digest(validToken);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(sha256TokenHasher.verify(validToken, digest)).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["whitespace-only", " ".repeat(43)],
    ["short", "A".repeat(42)],
    ["long", "A".repeat(44)],
    ["padded", `${"A".repeat(42)}=`],
    ["non-base64url", `${"A".repeat(42)}+`],
    ["leading whitespace", ` ${"A".repeat(42)}`],
    ["trailing whitespace", `${"A".repeat(42)} `],
  ])("rejects a structurally invalid %s token", (_label, token) => {
    expect(() => sha256TokenHasher.digest(token)).toThrow(InvalidTokenError);
  });

  it.each([
    ["uppercase", "A".repeat(64)],
    ["short", "a".repeat(63)],
    ["long", "a".repeat(65)],
    ["0x-prefixed", `0x${"a".repeat(62)}`],
    ["whitespace", " ".repeat(64)],
    ["non-hexadecimal", "g".repeat(64)],
  ])("rejects a non-canonical %s digest", (_label, digest) => {
    expect(() =>
      sha256TokenHasher.verify(validToken, digest as never)
    ).toThrow(InvalidTokenError);
  });

  it("returns false for a valid token and digest that do not match", () => {
    const otherDigest = sha256TokenHasher.digest(otherValidToken);
    expect(sha256TokenHasher.verify(validToken, otherDigest)).toBe(false);
  });

  it("uses a fixed error that does not echo invalid token material", () => {
    expect(new InvalidTokenError().message).toBe("Invalid token");
  });
});

describe("domain errors do not expose credentials, tokens, or hashes", () => {
  it("uses fixed public messages", () => {
    const secrets = [
      "plain-password",
      "opaque-token",
      "a".repeat(64),
    ];
    const errors = [
      new InvalidCredentialsError(),
      new InvalidTokenError(),
      new AccountInactiveError(),
      new AccountLockedError(),
      new InvitationNotFoundError(),
      new InvitationExpiredError(),
      new InvitationRevokedError(),
      new InvalidPasswordHashError(),
      new PasswordHashingError(),
      new AccountSessionNotFoundError(),
      new AccountSessionExpiredError(),
      new AccountSessionRevokedError(),
    ];

    for (const error of errors) {
      for (const secret of secrets) {
        expect(error.message).not.toContain(secret);
      }
    }
  });
});
