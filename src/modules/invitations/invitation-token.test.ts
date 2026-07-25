import { describe, expect, it } from "vitest";
import {
  assertTokenHash,
  InvalidTokenHashError,
  isTokenHash,
} from "@/lib/token-hash";
import { createInvitationToken, hashInvitationToken } from "./invitation-token";

describe("invitation tokens", () => {
  it("creates a different 256-bit token for each issuance", () => {
    const first = createInvitationToken();
    const second = createInvitationToken();

    expect(first.token).not.toBe(second.token);
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("hashes a token deterministically with SHA-256", () => {
    const token = "invitation-token";
    expect(hashInvitationToken(token)).toBe(hashInvitationToken(token));
    expect(hashInvitationToken(token)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns a hash that matches the generated token without exposing it as the hash", () => {
    const result = createInvitationToken();
    expect(result.tokenHash).toBe(hashInvitationToken(result.token));
    expect(result.tokenHash).not.toBe(result.token);
    expect(isTokenHash(result.tokenHash)).toBe(true);
    expect(isTokenHash(result.token)).toBe(false);
  });

  it.each([
    "plain-invitation-token",
    "a".repeat(63),
    "a".repeat(65),
    "A".repeat(64),
    "g".repeat(64),
  ])("rejects malformed persisted hash format", (value) => {
    expect(isTokenHash(value)).toBe(false);
    expect(() => assertTokenHash(value)).toThrow(InvalidTokenHashError);
  });

  it("does not include malformed token material in its error", () => {
    const value = "sensitive-plain-token";
    try {
      assertTokenHash(value);
      throw new Error("Expected assertTokenHash to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidTokenHashError);
      expect((error as Error).message).not.toContain(value);
    }
  });
});
