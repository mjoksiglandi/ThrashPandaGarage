import { describe, expect, it } from "vitest";
import { InvalidAccountEmailError } from "./account.errors";
import {
  assertCanonicalAccountEmail,
  isCanonicalAccountEmail,
  normalizeAccountEmail,
} from "./account-email";

describe("normalizeAccountEmail", () => {
  it("trims surrounding whitespace and lowercases the value", () => {
    expect(normalizeAccountEmail("  Client.Name@Example.COM ")).toBe(
      "client.name@example.com"
    );
  });

  it("is idempotent", () => {
    const normalized = normalizeAccountEmail(" Client@Example.COM ");
    expect(normalizeAccountEmail(normalized)).toBe(normalized);
  });

  it("rejects an email that is empty after trimming", () => {
    expect(() => normalizeAccountEmail(" \t\r\n ")).toThrow(
      InvalidAccountEmailError
    );
  });

  it.each(["missing-at.example.com", "missing-domain@", "user@localhost"])(
    "rejects invalid email %s",
    (value) => {
      expect(() => normalizeAccountEmail(value)).toThrow(
        InvalidAccountEmailError
      );
    }
  );

  it("distinguishes canonical email from input that still needs normalization", () => {
    expect(isCanonicalAccountEmail("client@example.com")).toBe(true);
    expect(isCanonicalAccountEmail(" Client@Example.COM ")).toBe(false);
    expect(() =>
      assertCanonicalAccountEmail(" Client@Example.COM ")
    ).toThrow(InvalidAccountEmailError);
  });
});
