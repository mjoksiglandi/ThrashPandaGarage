export const ACCOUNT_SESSION_COOKIE_NAME = "tpg_account_session";
export const LEGACY_CLIENT_COOKIE_NAME = "tpg_client";

function accountSessionCookieSecurityOptions(secure?: boolean) {
  return {
    httpOnly: true,
    secure: secure ?? process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export function accountSessionCookie(
  token: string,
  expiresAt: Date,
  options: {
    now?: Date;
    secure?: boolean;
  } = {}
) {
  const now = options.now ?? new Date();
  const remainingMs = expiresAt.getTime() - now.getTime();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    throw new Error("Cannot set an expired account session cookie");
  }

  return {
    name: ACCOUNT_SESSION_COOKIE_NAME,
    value: token,
    options: {
      ...accountSessionCookieSecurityOptions(options.secure),
      expires: expiresAt,
      maxAge: Math.max(1, Math.floor(remainingMs / 1000)),
    },
  };
}

function clearedSessionCookie(
  name: string,
  options: { secure?: boolean } = {}
) {
  return {
    name,
    value: "",
    options: {
      ...accountSessionCookieSecurityOptions(options.secure),
      expires: new Date(0),
      maxAge: 0,
    },
  };
}

export function clearedAccountSessionCookie(
  options: { secure?: boolean } = {}
) {
  return clearedSessionCookie(ACCOUNT_SESSION_COOKIE_NAME, options);
}

export function clearedLegacyClientCookie(
  options: { secure?: boolean } = {}
) {
  return clearedSessionCookie(LEGACY_CLIENT_COOKIE_NAME, options);
}
