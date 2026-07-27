export const LOGIN_EMAIL_MAX_LENGTH = 254;
export {
  ACCOUNT_PASSWORD_MAX_BYTES as LOGIN_PASSWORD_MAX_BYTES,
  ACCOUNT_PASSWORD_MAX_LENGTH as LOGIN_PASSWORD_MAX_LENGTH,
} from "./account-password-policy";
export const ACCOUNT_LOGIN_LOCK_POLICY = {
  failedAttemptThreshold: 5,
  lockDurationMs: 15 * 60 * 1000,
} as const;
export const ACCOUNT_SESSION_DURATION_MS =
  30 * 24 * 60 * 60 * 1000;
