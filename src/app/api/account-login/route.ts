import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  accountSessionCookie,
  clearedLegacyClientCookie,
} from "@/modules/account-sessions/account-session-cookie";
import { authenticateAccount } from "@/modules/accounts/account-login";
import {
  ACCOUNT_LOGIN_REDIRECT,
  LOGIN_CACHE_CONTROL,
  TEMPORARY_LOGIN_MESSAGE,
  isTrustedLoginOrigin,
  publicLoginError,
} from "@/modules/accounts/account-login-http";

function jsonResponse(
  body: { ok: boolean; error?: string },
  status: number
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": LOGIN_CACHE_CONTROL,
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function POST(request: NextRequest) {
  if (
    !isTrustedLoginOrigin({
      origin: request.headers.get("origin"),
      configuredBaseUrl: env.APP_BASE_URL,
    })
  ) {
    return jsonResponse(
      { ok: false, error: TEMPORARY_LOGIN_MESSAGE },
      403
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse(publicLoginError(new Error()).body, 503);
  }

  try {
    const session = await authenticateAccount({
      email: formData.get("email"),
      password: formData.get("password"),
    });
    const response = NextResponse.redirect(
      new URL(ACCOUNT_LOGIN_REDIRECT, env.APP_BASE_URL),
      303
    );
    response.headers.set("Cache-Control", LOGIN_CACHE_CONTROL);
    response.headers.set("Referrer-Policy", "no-referrer");
    const cookie = accountSessionCookie(
      session.token,
      session.expiresAt
    );
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    const legacyCookie = clearedLegacyClientCookie();
    response.cookies.set(
      legacyCookie.name,
      legacyCookie.value,
      legacyCookie.options
    );
    return response;
  } catch (error) {
    const publicError = publicLoginError(error);
    return jsonResponse(publicError.body, publicError.status);
  }
}
