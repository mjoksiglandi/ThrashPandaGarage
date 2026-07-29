import { NextResponse } from "next/server";
import {
  clearedAccountSessionCookie,
  clearedLegacyClientCookie,
} from "./account-session-cookie";
import type {
  AccountSessionPrincipal,
  AccountSessionResolution,
} from "./current-account-session.service";

export const ACCOUNT_SESSION_CACHE_CONTROL =
  "private, no-cache, no-store, max-age=0, must-revalidate";
export const ACCOUNT_AUTHENTICATION_MESSAGE = "Authentication required";
export const ACCOUNT_SESSION_TEMPORARY_MESSAGE =
  "Authentication service unavailable";

export class AccountAuthenticationRequiredError extends Error {
  constructor() {
    super(ACCOUNT_AUTHENTICATION_MESSAGE);
    this.name = "AccountAuthenticationRequiredError";
  }
}

export function applyPrivateAccountSessionHeaders(
  response: NextResponse
) {
  response.headers.set(
    "Cache-Control",
    ACCOUNT_SESSION_CACHE_CONTROL
  );
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export function clearAccountSessionCookies(response: NextResponse) {
  const accountCookie = clearedAccountSessionCookie();
  response.cookies.set(
    accountCookie.name,
    accountCookie.value,
    accountCookie.options
  );
  const legacyCookie = clearedLegacyClientCookie();
  response.cookies.set(
    legacyCookie.name,
    legacyCookie.value,
    legacyCookie.options
  );
  return response;
}

export function requireAuthenticatedAccount(
  resolution: AccountSessionResolution
): AccountSessionPrincipal {
  if (resolution.kind !== "authenticated") {
    throw new AccountAuthenticationRequiredError();
  }
  return resolution.principal;
}

export function publicAccountSessionError(error: unknown) {
  const unauthenticated =
    error instanceof AccountAuthenticationRequiredError;
  return {
    status: unauthenticated ? 401 : 503,
    body: {
      ok: false as const,
      error: unauthenticated
        ? ACCOUNT_AUTHENTICATION_MESSAGE
        : ACCOUNT_SESSION_TEMPORARY_MESSAGE,
    },
  };
}
