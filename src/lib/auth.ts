import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { signSessionValue, verifySessionValue } from "@/lib/session-token";
import { canAccessAdministration } from "@/modules/authorization/admin-authorization-policy";

const cookieName = "tpg_admin";

export type AuthenticatedAdmin = {
  id: string;
  email: string;
  role: UserRole;
};

const authenticatedAdminSelect = {
  id: true,
  email: true,
  role: true,
} as const;

export async function loginAdmin(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user?.passwordHash) return false;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok || !canAccessAdministration(user.role)) return false;

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

async function getSessionUser(): Promise<AuthenticatedAdmin | null> {
  const jar = await cookies();
  const userId = verifySessionValue(jar.get(cookieName)?.value, env.AUTH_SECRET);
  if (!userId) return null;
  return db.user.findUnique({
    where: { id: userId },
    select: authenticatedAdminSelect,
  });
}

export async function getCurrentAdmin(): Promise<AuthenticatedAdmin | null> {
  const user = await getSessionUser();
  return user && canAccessAdministration(user.role) ? user : null;
}

export async function requireAdmin(): Promise<AuthenticatedAdmin> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!canAccessAdministration(user.role)) {
    forbidden();
  }
  return user;
}
