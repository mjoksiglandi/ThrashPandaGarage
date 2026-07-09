import { describe, expect, it } from "vitest";
import { signSessionValue, verifySessionValue } from "./session-token";

const SECRET = "a".repeat(32);

describe("session-token", () => {
  it("round-trips a signed value", () => {
    const signed = signSessionValue("user_123", SECRET);
    expect(verifySessionValue(signed, SECRET)).toBe("user_123");
  });

  it("rejects a tampered userId", () => {
    const signed = signSessionValue("user_123", SECRET);
    const [, signature] = signed.split(".");
    const tampered = `user_999.${signature}`;
    expect(verifySessionValue(tampered, SECRET)).toBeNull();
  });

  it("rejects a value signed with a different secret", () => {
    const signed = signSessionValue("user_123", SECRET);
    expect(verifySessionValue(signed, "b".repeat(32))).toBeNull();
  });

  it("rejects a malformed value with no signature", () => {
    expect(verifySessionValue("user_123", SECRET)).toBeNull();
  });

  it("rejects an undefined value", () => {
    expect(verifySessionValue(undefined, SECRET)).toBeNull();
  });
});
