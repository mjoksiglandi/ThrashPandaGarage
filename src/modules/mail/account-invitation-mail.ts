import { env } from "@/lib/env";
import { createMailTransport } from "./mail-transport";

export const ACCOUNT_INVITATION_EMAIL_SUBJECT =
  "Activa tu cuenta — Trashpanda Garage";

export function accountInvitationUrl(baseUrl: string, token: string): string {
  const url = new URL("/invitations/accept", baseUrl);
  url.hash = encodeURIComponent(token);
  return url.toString();
}

export function accountInvitationEmailText(input: {
  invitationUrl: string;
  expiresInDays: number;
}): string {
  return `Te invitaron a activar tu cuenta de cliente en Trashpanda Garage.

Define tu contraseña usando este enlace:

${input.invitationUrl}

El enlace expira en ${input.expiresInDays} días y sólo puede utilizarse una vez.

Si no esperabas esta invitación, ignora este correo.`;
}

export async function sendAccountInvitationEmail(input: {
  to: string;
  token: string;
  expiresInDays: number;
}): Promise<void> {
  const invitationUrl = accountInvitationUrl(env.APP_BASE_URL, input.token);
  await createMailTransport().sendMail({
    from: env.MAIL_FROM,
    to: input.to,
    subject: ACCOUNT_INVITATION_EMAIL_SUBJECT,
    text: accountInvitationEmailText({
      invitationUrl,
      expiresInDays: input.expiresInDays,
    }),
  });
}
