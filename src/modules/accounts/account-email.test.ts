import { describe, expect, it } from "vitest";
import { InvalidAccountEmailError } from "./account.errors";
import { normalizeAccountEmail } from "./account-email";

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
});
