import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { signSessionValue, verifySessionValue } from "@/lib/session-token";
import { clientRepository } from "@/modules/clients/client.repository";

export const LEGACY_CLIENT_COOKIE_NAME = "tpg_client";

export async function loginClient(email: string, password: string) {
  const client = await clientRepository.findByEmail(email.trim());
  if (!client?.passwordHash || !(await bcrypt.compare(password, client.passwordHash))) return false;

  const jar = await cookies();
  jar.set(LEGACY_CLIENT_COOKIE_NAME, signSessionValue(client.id, env.AUTH_SECRET), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return true;
}

export async function resolveLegacyClientId(
  cookieValue: string
): Promise<string | null> {
  const clientId = verifySessionValue(cookieValue, env.AUTH_SECRET);
  if (!clientId) return null;
  const client = await clientRepository.findIdentity(clientId);
  return client?.id ?? null;
}
