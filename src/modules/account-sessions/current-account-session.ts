import "server-only";

import { cookies } from "next/headers";
import {
  ACCOUNT_SESSION_DURATION_MS,
} from "@/modules/accounts/account-login-policy";
import {
  createPrismaAccountServiceStore,
} from "@/modules/accounts/account-service.repository";
import {
  cryptoTokenGenerator,
  sha256TokenHasher,
} from "@/modules/accounts/secure-token";
import {
  createAccountSessionService,
} from "./account-session.service";
import { ACCOUNT_SESSION_COOKIE_NAME } from "./account-session-cookie";
import {
  createCurrentAccountSessionService,
} from "./current-account-session.service";

const accountSessions = createAccountSessionService({
  store: createPrismaAccountServiceStore(),
  clock: { now: () => new Date() },
  tokenGenerator: cryptoTokenGenerator,
  tokenHasher: sha256TokenHasher,
  sessionDurationMs: ACCOUNT_SESSION_DURATION_MS,
});

const currentAccountSessions = createCurrentAccountSessionService({
  accountSessions,
});

export function resolveAccountSessionToken(token: string | undefined) {
  return currentAccountSessions.resolve(token);
}

export function logoutAccountSessionToken(token: string | undefined) {
  return currentAccountSessions.logout(token);
}

export async function resolveCurrentAccountSession() {
  const cookieStore = await cookies();
  return resolveAccountSessionToken(
    cookieStore.get(ACCOUNT_SESSION_COOKIE_NAME)?.value
  );
}
