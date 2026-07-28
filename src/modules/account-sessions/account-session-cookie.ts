export const ACCOUNT_SESSION_COOKIE_NAME = "tpg_account_session";

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
      httpOnly: true,
      secure: options.secure ?? process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      expires: expiresAt,
      maxAge: Math.max(1, Math.floor(remainingMs / 1000)),
    },
  };
}
