import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimit("test-key");
  });

  it("allows up to the limit within the window", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("test-key", 5, 1000, 0)).toBe(true);
    }
  });

  it("blocks once the limit is exceeded", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("test-key", 5, 1000, 0);
    expect(checkRateLimit("test-key", 5, 1000, 500)).toBe(false);
  });

  it("resets once the window elapses", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("test-key", 5, 1000, 0);
    expect(checkRateLimit("test-key", 5, 1000, 1500)).toBe(true);
  });

  it("keeps separate buckets per key", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("test-key", 5, 1000, 0);
    expect(checkRateLimit("other-key", 5, 1000, 0)).toBe(true);
  });

  it("resetRateLimit clears the bucket immediately", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("test-key", 5, 1000, 0);
    resetRateLimit("test-key");
    expect(checkRateLimit("test-key", 5, 1000, 0)).toBe(true);
  });
});
