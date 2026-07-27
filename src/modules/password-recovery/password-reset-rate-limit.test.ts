import { describe, expect, it } from "vitest";
import {
  PASSWORD_RESET_RATE_LIMIT,
  checkPasswordResetRateLimit,
} from "./password-reset-rate-limit";

describe("password reset rate limit", () => {
  it("limits by token fingerprint without storing the token as a key", () => {
    const token = "unique-token-for-rate-limit";
    const origin = "rate-limit-origin-a";
    for (
      let attempt = 0;
      attempt < PASSWORD_RESET_RATE_LIMIT.token;
      attempt += 1
    ) {
      expect(
        checkPasswordResetRateLimit({ token, origin, now: 100 })
      ).toBe(true);
    }
    expect(
      checkPasswordResetRateLimit({ token, origin, now: 100 })
    ).toBe(false);
    expect(
      checkPasswordResetRateLimit({
        token: "different-token",
        origin,
        now: 100,
      })
    ).toBe(true);
  });

  it("limits random tokens by origin and resets after the window", () => {
    const origin = "rate-limit-origin-b";
    for (
      let attempt = 0;
      attempt < PASSWORD_RESET_RATE_LIMIT.origin;
      attempt += 1
    ) {
      expect(
        checkPasswordResetRateLimit({
          token: `random-${attempt}`,
          origin,
          now: 200,
        })
      ).toBe(true);
    }
    expect(
      checkPasswordResetRateLimit({
        token: "blocked-random",
        origin,
        now: 200,
      })
    ).toBe(false);
    expect(
      checkPasswordResetRateLimit({
        token: "after-window",
        origin,
        now: 200 + PASSWORD_RESET_RATE_LIMIT.windowMs + 1,
      })
    ).toBe(true);
  });

  it("handles non-string tokens without reflecting them", () => {
    expect(
      checkPasswordResetRateLimit({
        token: { secret: "not-a-token" },
        origin: "rate-limit-origin-c",
        now: 300,
      })
    ).toBe(true);
  });
});
