import { describe, expect, it } from "vitest";
import { normalizeAccountEmail } from "@/modules/accounts/account-email";
import {
  PASSWORD_RECOVERY_RATE_LIMIT,
  checkPasswordRecoveryRateLimit,
} from "./password-recovery-rate-limit";

let sequence = 0;

function email(label: string) {
  sequence += 1;
  return normalizeAccountEmail(`${label}-${sequence}@example.test`);
}

describe("password recovery rate limiting", () => {
  it("limits one canonical email to three requests per window", () => {
    const identity = email("identity");
    for (let index = 0; index < PASSWORD_RECOVERY_RATE_LIMIT.email; index += 1) {
      expect(
        checkPasswordRecoveryRateLimit({
          email: identity,
          origin: `origin-${index}`,
          now: 0,
        })
      ).toBe(true);
    }
    expect(
      checkPasswordRecoveryRateLimit({
        email: identity,
        origin: "origin-blocked",
        now: 0,
      })
    ).toBe(false);
  });

  it("limits one origin to ten requests across different emails", () => {
    const origin = `shared-origin-${sequence}`;
    for (
      let index = 0;
      index < PASSWORD_RECOVERY_RATE_LIMIT.origin;
      index += 1
    ) {
      expect(
        checkPasswordRecoveryRateLimit({
          email: email(`origin-${index}`),
          origin,
          now: 0,
        })
      ).toBe(true);
    }
    expect(
      checkPasswordRecoveryRateLimit({
        email: email("origin-blocked"),
        origin,
        now: 0,
      })
    ).toBe(false);
  });

  it("resets both dimensions at the exact window boundary", () => {
    const identity = email("reset");
    const origin = `reset-origin-${sequence}`;
    for (let index = 0; index < PASSWORD_RECOVERY_RATE_LIMIT.email; index += 1) {
      checkPasswordRecoveryRateLimit({
        email: identity,
        origin,
        now: 0,
      });
    }
    expect(
      checkPasswordRecoveryRateLimit({
        email: identity,
        origin,
        now: PASSWORD_RECOVERY_RATE_LIMIT.windowMs,
      })
    ).toBe(true);
  });

  it("skips the origin dimension without a trusted proxy boundary", () => {
    for (
      let index = 0;
      index <= PASSWORD_RECOVERY_RATE_LIMIT.origin;
      index += 1
    ) {
      expect(
        checkPasswordRecoveryRateLimit({
          email: email(`untrusted-${index}`),
          origin: null,
          now: 0,
        })
      ).toBe(true);
    }
  });
});
