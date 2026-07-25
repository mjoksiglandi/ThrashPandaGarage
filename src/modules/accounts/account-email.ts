import { InvalidAccountEmailError } from "./account.errors";

declare const normalizedAccountEmailBrand: unique symbol;

export type NormalizedAccountEmail = string & {
  readonly [normalizedAccountEmailBrand]: true;
};

export function normalizeAccountEmail(value: string): NormalizedAccountEmail {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    throw new InvalidAccountEmailError();
  }
  return normalized as NormalizedAccountEmail;
}
