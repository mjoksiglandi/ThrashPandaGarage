import { after, NextRequest, NextResponse } from "next/server";
import { resolveTrustedClientIp } from "@/lib/client-origin";
import { env } from "@/lib/env";
import { InvalidAccountEmailError } from "@/modules/accounts/account.errors";
import {
  requestAccountPasswordRecovery,
} from "@/modules/password-recovery/password-recovery";
import {
  parsePasswordRecoveryEmail,
} from "@/modules/password-recovery/password-recovery.service";

export const PASSWORD_RECOVERY_PUBLIC_MESSAGE =
  "Si existe una cuenta asociada a ese correo, enviaremos instrucciones para recuperar el acceso.";
export const PASSWORD_RECOVERY_INVALID_MESSAGE =
  "Ingresa un correo electrónico válido.";
export const PASSWORD_RECOVERY_CACHE_CONTROL =
  "private, no-cache, no-store, max-age=0, must-revalidate";

function response(
  body: { ok: boolean; message?: string; error?: string },
  status: number
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": PASSWORD_RECOVERY_CACHE_CONTROL,
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return response(
      { ok: false, error: PASSWORD_RECOVERY_INVALID_MESSAGE },
      400
    );
  }

  try {
    const email = parsePasswordRecoveryEmail(
      typeof body === "object" && body !== null && "email" in body
        ? body.email
        : undefined
    );
    const origin = resolveTrustedClientIp(
      request.headers,
      env.TRUSTED_CLIENT_IP_HEADER
    );
    after(() =>
      requestAccountPasswordRecovery({ email, origin })
    );
  } catch (error) {
    if (error instanceof InvalidAccountEmailError) {
      return response(
        { ok: false, error: PASSWORD_RECOVERY_INVALID_MESSAGE },
        400
      );
    }
  }

  return response(
    { ok: true, message: PASSWORD_RECOVERY_PUBLIC_MESSAGE },
    202
  );
}
