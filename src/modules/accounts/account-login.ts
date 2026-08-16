import "server-only";

import bcrypt from "bcryptjs";
import {
  createAccountSessionService,
} from "@/modules/account-sessions/account-session.service";
import {
  createPrismaAccountServiceStore,
} from "./account-service.repository";
import { createAccountLoginService } from "./account-login.service";
import {
  createAuthenticationAttemptService,
} from "./authentication-attempt.service";
import {
  cryptoTokenGenerator,
  sha256TokenHasher,
} from "./secure-token";
import {
  ACCOUNT_LOGIN_LOCK_POLICY,
  ACCOUNT_SESSION_DURATION_MS,
} from "./account-login-policy";

// This is a cost-12 bcrypt hash for a public sentinel, never a user password.
// It keeps valid-but-unknown emails on the same bcrypt path as real accounts.
const NONEXISTENT_ACCOUNT_PASSWORD_HASH =
  "$2b$12$1gTCQUmsKfP9A3Z/RgHFneq8Hku/8J5g8YbSQny7H5GTSRxIrMzfC";

const store = createPrismaAccountServiceStore();
const clock = { now: () => new Date() };
const authenticationAttempts = createAuthenticationAttemptService({
  store,
  clock,
  lockPolicy: ACCOUNT_LOGIN_LOCK_POLICY,
});
const accountSessions = createAccountSessionService({
  store,
  clock,
  tokenGenerator: cryptoTokenGenerator,
  tokenHasher: sha256TokenHasher,
  sessionDurationMs: ACCOUNT_SESSION_DURATION_MS,
});
const accountLoginService = createAccountLoginService({
  store,
  authenticationAttempts,
  accountSessions,
  passwordVerifier: {
    verify: (password, passwordHash) =>
      bcrypt.compare(password, passwordHash),
  },
  nonexistentAccountPasswordHash:
    NONEXISTENT_ACCOUNT_PASSWORD_HASH,
});

export function authenticateAccount(input: {
  email: unknown;
  password: unknown;
}) {
  return accountLoginService.authenticate(input);
}
