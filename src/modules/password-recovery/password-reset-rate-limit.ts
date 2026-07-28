import { createHash } from "node:crypto";
import { checkRateLimit } from "@/lib/rate-limit";

export const PASSWORD_RESET_RATE_LIMIT = {
  token: 5,
  origin: 15,
  windowMs: 15 * 60 * 1000,
} as const;

function digest(value: unknown): string {
  return createHash("sha256")
    .update(typeof value === "string" ? value : `invalid:${typeof value}`)
    .digest("hex");
}

export function checkPasswordResetRateLimit(input: {
  token: unknown;
  origin: string;
  now?: number;
}): boolean {
  const now = input.now ?? Date.now();
  const tokenAllowed = checkRateLimit(
    `account-password-reset:token:${digest(input.token)}`,
    PASSWORD_RESET_RATE_LIMIT.token,
    PASSWORD_RESET_RATE_LIMIT.windowMs,
    now
  );
  const originAllowed = checkRateLimit(
    `account-password-reset:origin:${digest(input.origin)}`,
    PASSWORD_RESET_RATE_LIMIT.origin,
    PASSWORD_RESET_RATE_LIMIT.windowMs,
    now
  );
  return tokenAllowed && originAllowed;
}
