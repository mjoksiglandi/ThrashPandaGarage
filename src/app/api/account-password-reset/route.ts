import { NextRequest, NextResponse } from "next/server";
import { InvalidCredentialsError } from "@/modules/accounts/account.errors";
import {
  PasswordResetRateLimitedError,
  resetAccountPassword,
} from "@/modules/password-recovery/password-reset";
import {
  PasswordResetHashingError,
  PasswordResetUnavailableError,
} from "@/modules/password-recovery/password-reset.service";
import {
  PASSWORD_RESET_CACHE_CONTROL,
  PASSWORD_RESET_PASSWORD_MESSAGE,
  PASSWORD_RESET_SUCCESS_MESSAGE,
  PASSWORD_RESET_TEMPORARY_MESSAGE,
  PASSWORD_RESET_UNAVAILABLE_MESSAGE,
} from "@/modules/password-recovery/password-reset-http";

export {
  PASSWORD_RESET_CACHE_CONTROL,
  PASSWORD_RESET_PASSWORD_MESSAGE,
  PASSWORD_RESET_SUCCESS_MESSAGE,
  PASSWORD_RESET_TEMPORARY_MESSAGE,
  PASSWORD_RESET_UNAVAILABLE_MESSAGE,
} from "@/modules/password-recovery/password-reset-http";

function response(
  body: { ok: boolean; message: string },
  status: number
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": PASSWORD_RESET_CACHE_CONTROL,
      "Referrer-Policy": "no-referrer",
    },
  });
}

function clientOrigin(request: NextRequest): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return response(
      { ok: false, message: PASSWORD_RESET_UNAVAILABLE_MESSAGE },
      400
    );
  }

  const token =
    typeof body === "object" && body !== null && "token" in body
      ? body.token
      : undefined;
  const password =
    typeof body === "object" && body !== null && "password" in body
      ? body.password
      : undefined;

  try {
    await resetAccountPassword({
      token,
      password,
      origin: clientOrigin(request),
    });
    return response(
      { ok: true, message: PASSWORD_RESET_SUCCESS_MESSAGE },
      200
    );
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      return response(
        { ok: false, message: PASSWORD_RESET_PASSWORD_MESSAGE },
        400
      );
    }
    if (error instanceof PasswordResetUnavailableError) {
      return response(
        { ok: false, message: PASSWORD_RESET_UNAVAILABLE_MESSAGE },
        400
      );
    }
    if (error instanceof PasswordResetRateLimitedError) {
      return response(
        { ok: false, message: PASSWORD_RESET_TEMPORARY_MESSAGE },
        429
      );
    }
    if (error instanceof PasswordResetHashingError) {
      return response(
        { ok: false, message: PASSWORD_RESET_TEMPORARY_MESSAGE },
        503
      );
    }

    console.error("Account password reset failed");
    return response(
      { ok: false, message: PASSWORD_RESET_TEMPORARY_MESSAGE },
      503
    );
  }
}
