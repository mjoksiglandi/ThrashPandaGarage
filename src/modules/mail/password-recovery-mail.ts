import { env } from "@/lib/env";
import { createMailTransport } from "./mail-transport";

export const PASSWORD_RECOVERY_EMAIL_SUBJECT =
  "Recupera tu acceso — Trashpanda Garage";

export function passwordRecoveryUrl(baseUrl: string, token: string): string {
  const url = new URL("/account/password-reset", baseUrl);
  url.hash = `token=${encodeURIComponent(token)}`;
  return url.toString();
}

export function passwordRecoveryEmailText(input: {
  recoveryUrl: string;
  expiresInMinutes: number;
}): string {
  return `Se solicitó recuperar la contraseña de tu cuenta de Trashpanda Garage.

Usa este enlace para continuar:

${input.recoveryUrl}

El enlace expira en ${input.expiresInMinutes} minutos y sólo puede utilizarse una vez.

Si no solicitaste recuperar tu acceso, ignora este correo.`;
}

export async function sendPasswordRecoveryEmail(input: {
  to: string;
  token: string;
  expiresInMinutes: number;
}): Promise<void> {
  const recoveryUrl = passwordRecoveryUrl(env.APP_BASE_URL, input.token);
  await createMailTransport().sendMail({
    from: env.MAIL_FROM,
    to: input.to,
    subject: PASSWORD_RECOVERY_EMAIL_SUBJECT,
    text: passwordRecoveryEmailText({
      recoveryUrl,
      expiresInMinutes: input.expiresInMinutes,
    }),
  });
}
