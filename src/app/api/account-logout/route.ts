import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  ACCOUNT_SESSION_TEMPORARY_MESSAGE,
  applyPrivateAccountSessionHeaders,
  clearAccountSessionCookies,
} from "@/modules/account-sessions/account-session-http";
import {
  ACCOUNT_SESSION_COOKIE_NAME,
} from "@/modules/account-sessions/account-session-cookie";
import {
  logoutAccountSessionToken,
} from "@/modules/account-sessions/current-account-session";
import { isTrustedLoginOrigin } from "@/modules/accounts/account-login-http";

export async function POST(request: NextRequest) {
  if (
    !isTrustedLoginOrigin({
      origin: request.headers.get("origin"),
      configuredBaseUrl: env.APP_BASE_URL,
    })
  ) {
    return applyPrivateAccountSessionHeaders(
      NextResponse.json(
        { ok: false, error: ACCOUNT_SESSION_TEMPORARY_MESSAGE },
        { status: 403 }
      )
    );
  }

  let response: NextResponse;
  try {
    await logoutAccountSessionToken(
      request.cookies.get(ACCOUNT_SESSION_COOKIE_NAME)?.value
    );
    response = new NextResponse(null, { status: 204 });
  } catch {
    response = NextResponse.json(
      { ok: false, error: ACCOUNT_SESSION_TEMPORARY_MESSAGE },
      { status: 503 }
    );
  }

  return clearAccountSessionCookies(
    applyPrivateAccountSessionHeaders(response)
  );
}
