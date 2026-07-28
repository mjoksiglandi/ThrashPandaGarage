import { InvalidCredentialsError } from "./account.errors";

export const ACCOUNT_PASSWORD_MIN_LENGTH = 12;
export const ACCOUNT_PASSWORD_MAX_LENGTH = 72;
export const ACCOUNT_PASSWORD_MAX_BYTES = 72;

// Passwords are validated but never trimmed, normalized, or otherwise changed.
export function assertNewAccountPassword(
  password: unknown
): asserts password is string {
  if (
    typeof password !== "string" ||
    password.length < ACCOUNT_PASSWORD_MIN_LENGTH ||
    password.trim().length === 0 ||
    password.length > ACCOUNT_PASSWORD_MAX_LENGTH ||
    Buffer.byteLength(password, "utf8") > ACCOUNT_PASSWORD_MAX_BYTES
  ) {
    throw new InvalidCredentialsError();
  }
}
