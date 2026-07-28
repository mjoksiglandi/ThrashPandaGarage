import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimit("test-key");
    resetRateLimit("other-key");
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

  it("fails closed for new attacker-controlled keys at the bound", () => {
    const keys = Array.from(
      { length: 4_097 },
      (_, index) => `bounded-${index}`
    );
    try {
      for (const key of keys.slice(0, 4_096)) {
        expect(checkRateLimit(key, 1, 1000, 0)).toBe(true);
      }

      expect(checkRateLimit(keys[4_096], 1, 1000, 0)).toBe(false);
      expect(checkRateLimit(keys[0], 1, 1000, 0)).toBe(false);
    } finally {
      for (const key of keys) {
        resetRateLimit(key);
      }
    }
  });

  it("reclaims expired buckets immediately when the bound is full", () => {
    const keys = Array.from(
      { length: 4_096 },
      (_, index) => `expired-${index}`
    );
    try {
      for (const key of keys) {
        expect(checkRateLimit(key, 1, 1000, 0)).toBe(true);
      }

      expect(checkRateLimit("after-expiry", 1, 1000, 1000)).toBe(true);
    } finally {
      for (const key of keys) {
        resetRateLimit(key);
      }
      resetRateLimit("after-expiry");
    }
  });
});
