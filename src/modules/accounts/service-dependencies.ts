import { InvalidAccountPolicyError } from "./account.errors";

export interface Clock {
  now(): Date;
}

export function expiresAfter(
  now: Date,
  durationMs: number
): Date {
  if (!Number.isInteger(durationMs) || durationMs < 1) {
    throw new InvalidAccountPolicyError();
  }
  return new Date(now.getTime() + durationMs);
}
