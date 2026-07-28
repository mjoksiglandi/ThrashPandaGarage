import { InvalidAccountEmailError } from "./account.errors";

declare const normalizedAccountEmailBrand: unique symbol;

export type NormalizedAccountEmail = string & {
  readonly [normalizedAccountEmailBrand]: true;
};

const ACCOUNT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isCanonicalAccountEmail(
  value: string
): value is NormalizedAccountEmail {
  return (
    value === value.trim().toLowerCase() &&
    ACCOUNT_EMAIL_PATTERN.test(value)
  );
}

export function assertCanonicalAccountEmail(
  value: string
): asserts value is NormalizedAccountEmail {
  if (!isCanonicalAccountEmail(value)) {
    throw new InvalidAccountEmailError();
  }
}

export function normalizeAccountEmail(value: string): NormalizedAccountEmail {
  const normalized = value.trim().toLowerCase();
  assertCanonicalAccountEmail(normalized);
  return normalized;
}
