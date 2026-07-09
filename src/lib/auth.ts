import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { signSessionValue, verifySessionValue } from "@/lib/session-token";

const cookieName = "tpg_admin";

export async function loginAdmin(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user?.passwordHash) return false;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return false;

  const jar = await cookies();
  jar.set(cookieName, signSessionValue(user.id, env.AUTH_SECRET), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return true;
}

export async function logoutAdmin() {
  const jar = await cookies();
  jar.delete(cookieName);
}

export async function getCurrentAdmin() {
  const jar = await cookies();
  const userId = verifySessionValue(jar.get(cookieName)?.value, env.AUTH_SECRET);
  if (!userId) return null;
  return db.user.findUnique({ where: { id: userId } });
}

export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
