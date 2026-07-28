export const LOGIN_EMAIL_MAX_LENGTH = 254;
export const LOGIN_PASSWORD_MAX_LENGTH = 72;
export const LOGIN_PASSWORD_MAX_BYTES = 72;
export const ACCOUNT_LOGIN_LOCK_POLICY = {
  failedAttemptThreshold: 5,
  lockDurationMs: 15 * 60 * 1000,
} as const;
export const ACCOUNT_SESSION_DURATION_MS =
  30 * 24 * 60 * 60 * 1000;
