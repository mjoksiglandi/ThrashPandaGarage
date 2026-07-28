import { describe, expect, it } from "vitest";
import { resolveTrustedClientIp } from "./client-origin";

describe("trusted client IP boundary", () => {
  const headers = new Headers({
    "cf-connecting-ip": "198.51.100.7",
    "x-forwarded-for": "203.0.113.5, 10.0.0.1",
  });

  it("ignores forwarding headers unless one trusted proxy is configured", () => {
    expect(resolveTrustedClientIp(headers, "none")).toBeNull();
  });

  it("reads only the explicitly trusted header", () => {
    expect(
      resolveTrustedClientIp(headers, "cf-connecting-ip")
    ).toBe("198.51.100.7");
    expect(
      resolveTrustedClientIp(headers, "x-forwarded-for")
    ).toBe("203.0.113.5");
  });

  it.each([
    "unknown",
    "203.0.113.5:443",
    "203.0.113.5, attacker",
    "not-an-ip",
  ])("rejects malformed trusted values %s", (value) => {
    expect(
      resolveTrustedClientIp(
        new Headers({ "cf-connecting-ip": value }),
        "cf-connecting-ip"
      )
    ).toBeNull();
  });
});
