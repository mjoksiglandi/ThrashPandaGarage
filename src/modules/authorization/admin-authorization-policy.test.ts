import { UserRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canAccessAdministration } from "./admin-authorization-policy";

describe("canAccessAdministration", () => {
  it.each([
    [true, UserRole.ADMIN],
    [false, UserRole.STAFF],
    [false, UserRole.CLIENT],
  ])("returns %s for %s", (expected, role) => {
    expect(canAccessAdministration(role)).toBe(expected);
  });

  it("denies an unknown legacy role", () => {
    expect(canAccessAdministration("EDITOR" as UserRole)).toBe(false);
  });
});
