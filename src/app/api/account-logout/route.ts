import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  ACCOUNT_SESSION_CACHE_CONTROL,
  ACCOUNT_SESSION_TEMPORARY_MESSAGE,
} from "@/modules/account-sessions/account-session-http";
import {
  ACCOUNT_SESSION_COOKIE_NAME,
  clearedAccountSessionCookie,
  clearedLegacyClientCookie,
} from "@/modules/account-sessions/account-session-cookie";
import {
  logoutAccountSessionToken,
} from "@/modules/account-sessions/current-account-session";
import { isTrustedLoginOrigin } from "@/modules/accounts/account-login-http";

function applyPrivateAuthHeaders(response: NextResponse) {
  response.headers.set(
    "Cache-Control",
    ACCOUNT_SESSION_CACHE_CONTROL
  );
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function clearSessionCookie(response: NextResponse) {
  const cookie = clearedAccountSessionCookie();
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  const legacyCookie = clearedLegacyClientCookie();
  response.cookies.set(
    legacyCookie.name,
    legacyCookie.value,
    legacyCookie.options
  );
  return response;
}

export async function POST(request: NextRequest) {
  if (
    !isTrustedLoginOrigin({
      origin: request.headers.get("origin"),
      configuredBaseUrl: env.APP_BASE_URL,
    })
  ) {
    return applyPrivateAuthHeaders(
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

  return clearSessionCookie(applyPrivateAuthHeaders(response));
}
