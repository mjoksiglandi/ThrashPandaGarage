import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  redirect: vi.fn(),
  findUnique: vi.fn(),
  verifySessionValue: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: mocks.findUnique,
    },
  },
}));
vi.mock("@/lib/env", () => ({ env: { AUTH_SECRET: "test-secret" } }));
vi.mock("@/lib/session-token", () => ({
  signSessionValue: vi.fn(),
  verifySessionValue: mocks.verifySessionValue,
}));

import {
  ForbiddenError,
  getCurrentAdmin,
  requireAdmin,
  type AuthenticatedAdmin,
} from "./auth";

const admin: AuthenticatedAdmin = {
  id: "admin-1",
  email: "admin@example.com",
  role: UserRole.ADMIN,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookies.mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: "signed-session" }),
  });
  mocks.verifySessionValue.mockReturnValue(admin.id);
  mocks.findUnique.mockResolvedValue(admin);
  mocks.redirect.mockImplementation(() => {
    throw new Error("NEXT_REDIRECT");
  });
});

describe("requireAdmin", () => {
  it("returns only id, email, and role for a valid ADMIN session", async () => {
    const result = await requireAdmin();

    expect(result).toEqual(admin);
    expect(result).not.toHaveProperty("passwordHash");
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: admin.id },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });
  });

  it("rejects a missing session before querying the user", async () => {
    mocks.verifySessionValue.mockReturnValueOnce(null);

    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/admin/login");
  });

  it("rejects a session whose user no longer exists", async () => {
    mocks.findUnique.mockResolvedValueOnce(null);

    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.redirect).toHaveBeenCalledWith("/admin/login");
  });

  it("rejects a user without the ADMIN role with a forbidden domain error", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      ...admin,
      role: "EDITOR" as unknown as UserRole,
    });

    await expect(requireAdmin()).rejects.toMatchObject({
      name: ForbiddenError.name,
      statusCode: 403,
    });

    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe("getCurrentAdmin", () => {
  it("does not treat an authenticated non-admin user as an admin", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      ...admin,
      role: "EDITOR" as unknown as UserRole,
    });

    await expect(getCurrentAdmin()).resolves.toBeNull();
  });
});
