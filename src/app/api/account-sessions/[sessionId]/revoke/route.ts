import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  ACCOUNT_SESSION_TEMPORARY_MESSAGE,
  applyPrivateAccountSessionHeaders,
  clearAccountSessionCookies,
  publicAccountSessionError,
} from "@/modules/account-sessions/account-session-http";
import { ACCOUNT_SESSION_COOKIE_NAME } from "@/modules/account-sessions/account-session-cookie";
import { requireAccountSession } from "@/modules/account-sessions/account-session-guard";
import { revokeOwnedAccountSession } from "@/modules/account-sessions/account-session-management";
import { logoutAccountSessionToken } from "@/modules/account-sessions/current-account-session";
import { isTrustedLoginOrigin } from "@/modules/accounts/account-login-http";

const ACCOUNT_SESSIONS_REDIRECT = "/portal/sessions";
const ACCOUNT_LOGIN_REDIRECT = "/portal/login";

function genericError(status: number) {
  return NextResponse.json(
    { ok: false, error: ACCOUNT_SESSION_TEMPORARY_MESSAGE },
    { status }
  );
}

export async function POST(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ sessionId: string }> }
) {
  if (
    !isTrustedLoginOrigin({
      origin: request.headers.get("origin"),
      configuredBaseUrl: env.APP_BASE_URL,
    })
  ) {
    return applyPrivateAccountSessionHeaders(genericError(403));
  }

  let principal;
  try {
    principal = await requireAccountSession();
  } catch (error) {
    const publicError = publicAccountSessionError(error);
    return applyPrivateAccountSessionHeaders(
      NextResponse.json(publicError.body, {
        status: publicError.status,
      })
    );
  }

  const { sessionId } = await params;
  if (sessionId === principal.sessionId) {
    let response: NextResponse;
    try {
      await logoutAccountSessionToken(
        request.cookies.get(ACCOUNT_SESSION_COOKIE_NAME)?.value
      );
      response = NextResponse.redirect(
        new URL(ACCOUNT_LOGIN_REDIRECT, env.APP_BASE_URL),
        303
      );
    } catch {
      response = genericError(503);
    }
    return clearAccountSessionCookies(
      applyPrivateAccountSessionHeaders(response)
    );
  }

  try {
    await revokeOwnedAccountSession(principal, sessionId);
    return applyPrivateAccountSessionHeaders(
      NextResponse.redirect(
        new URL(ACCOUNT_SESSIONS_REDIRECT, env.APP_BASE_URL),
        303
      )
    );
  } catch {
    return applyPrivateAccountSessionHeaders(genericError(503));
  }
}
