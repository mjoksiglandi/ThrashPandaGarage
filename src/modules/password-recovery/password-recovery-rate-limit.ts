import { createHash } from "node:crypto";
import { checkRateLimit } from "@/lib/rate-limit";
import type { NormalizedAccountEmail } from "@/modules/accounts/account-email";

export const PASSWORD_RECOVERY_RATE_LIMIT = {
  email: 3,
  origin: 10,
  windowMs: 15 * 60 * 1000,
} as const;

function key(kind: "email" | "origin", value: string): string {
  const digest = createHash("sha256").update(value).digest("hex");
  return `account-password-recovery:${kind}:${digest}`;
}

// This matches the existing in-process limiter. Use shared storage before
// horizontally scaling the application.
export function checkPasswordRecoveryRateLimit(input: {
  email: NormalizedAccountEmail;
  origin: string;
  now?: number;
}): boolean {
  const now = input.now ?? Date.now();
  const emailAllowed = checkRateLimit(
    key("email", input.email),
    PASSWORD_RECOVERY_RATE_LIMIT.email,
    PASSWORD_RECOVERY_RATE_LIMIT.windowMs,
    now
  );
  const originAllowed = checkRateLimit(
    key("origin", input.origin),
    PASSWORD_RECOVERY_RATE_LIMIT.origin,
    PASSWORD_RECOVERY_RATE_LIMIT.windowMs,
    now
  );
  return emailAllowed && originAllowed;
}
