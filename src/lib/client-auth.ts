import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { signSessionValue, verifySessionValue } from "@/lib/session-token";
import { clientRepository } from "@/modules/clients/client.repository";

const cookieName = "tpg_client";

export async function loginClient(email: string, password: string) {
  const client = await clientRepository.findByEmail(email.trim());
  if (!client?.passwordHash || !(await bcrypt.compare(password, client.passwordHash))) return false;

  const jar = await cookies();
  jar.set(cookieName, signSessionValue(client.id, env.AUTH_SECRET), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return true;
}

export async function logoutClient() {
  const jar = await cookies();
  jar.delete(cookieName);
}

async function getCurrentClient() {
  const jar = await cookies();
  const clientId = verifySessionValue(jar.get(cookieName)?.value, env.AUTH_SECRET);
  if (!clientId) return null;
  return clientRepository.find(clientId);
}

export async function requireClient() {
  const client = await getCurrentClient();
  if (!client) redirect("/portal/login");
  return client;
}
