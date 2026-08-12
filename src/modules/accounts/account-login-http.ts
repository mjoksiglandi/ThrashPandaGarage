import {
  AccountInactiveError,
  AccountLockedError,
  AccountNotFoundError,
  InvalidCredentialsError,
} from "./account.errors";

export const INVALID_LOGIN_MESSAGE =
  "Correo electrónico o contraseña incorrectos.";
export const TEMPORARY_LOGIN_MESSAGE =
  "No pudimos iniciar sesión. Inténtalo nuevamente.";
export const ACCOUNT_LOGIN_REDIRECT = "/portal";
export const ADMIN_LOGIN_REDIRECT = "/admin";
export const LOGIN_CACHE_CONTROL =
  "private, no-cache, no-store, max-age=0, must-revalidate";

const invalidCredentialErrors = [
  InvalidCredentialsError,
  AccountNotFoundError,
  AccountInactiveError,
  AccountLockedError,
] as const;

export function publicLoginError(error: unknown) {
  const invalidCredentials = invalidCredentialErrors.some(
    (ErrorType) => error instanceof ErrorType
  );
  return {
    status: invalidCredentials ? 401 : 503,
    body: {
      ok: false as const,
      error: invalidCredentials
        ? INVALID_LOGIN_MESSAGE
        : TEMPORARY_LOGIN_MESSAGE,
    },
  };
}

export function isTrustedLoginOrigin(input: {
  origin: string | null;
  configuredBaseUrl: string;
}): boolean {
  if (!input.origin) {
    return false;
  }

  try {
    const parsedOrigin = new URL(input.origin);
    const configuredOrigin = new URL(input.configuredBaseUrl).origin;
    return (
      parsedOrigin.origin === input.origin &&
      parsedOrigin.origin === configuredOrigin
    );
  } catch {
    return false;
  }
}
