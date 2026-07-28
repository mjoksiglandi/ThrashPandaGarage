import { UserRole } from "@prisma/client";

export function canAccessAdministration(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}
