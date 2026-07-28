import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  compare: vi.fn(),
  forbidden: vi.fn(),
  redirect: vi.fn(),
  findUnique: vi.fn(),
  setCookie: vi.fn(),
  signSessionValue: vi.fn(),
  verifySessionValue: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: { compare: mocks.compare },
}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({
  forbidden: mocks.forbidden,
  redirect: mocks.redirect,
}));
vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: mocks.findUnique,
    },
  },
}));
vi.mock("@/lib/env", () => ({ env: { AUTH_SECRET: "test-secret" } }));
vi.mock("@/lib/session-token", () => ({
  signSessionValue: mocks.signSessionValue,
  verifySessionValue: mocks.verifySessionValue,
}));

import {
  getCurrentAdmin,
  loginAdmin,
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
    set: mocks.setCookie,
  });
  mocks.compare.mockResolvedValue(true);
  mocks.signSessionValue.mockReturnValue("signed-admin-session");
  mocks.verifySessionValue.mockReturnValue(admin.id);
  mocks.findUnique.mockResolvedValue(admin);
  mocks.forbidden.mockImplementation(() => {
    throw new Error("NEXT_FORBIDDEN");
  });
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

  it.each([UserRole.STAFF, UserRole.CLIENT])(
    "rejects a %s user with a forbidden domain error",
    async (role) => {
      mocks.findUnique.mockResolvedValueOnce({
        ...admin,
        role,
      });

      await expect(requireAdmin()).rejects.toThrow("NEXT_FORBIDDEN");

      expect(mocks.forbidden).toHaveBeenCalledOnce();
      expect(mocks.redirect).not.toHaveBeenCalled();
    }
  );
});

describe("getCurrentAdmin", () => {
  it.each([UserRole.STAFF, UserRole.CLIENT])(
    "does not treat an authenticated %s user as an admin",
    async (role) => {
      mocks.findUnique.mockResolvedValueOnce({
        ...admin,
        role,
      });

      await expect(getCurrentAdmin()).resolves.toBeNull();
    }
  );
});

describe("loginAdmin", () => {
  it("creates an admin cookie for valid ADMIN credentials", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      ...admin,
      passwordHash: "stored-password-hash",
    });

    await expect(
      loginAdmin(admin.email, "valid-password")
    ).resolves.toBe(true);

    expect(mocks.setCookie).toHaveBeenCalledWith(
      "tpg_admin",
      "signed-admin-session",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      })
    );
  });

  it.each([UserRole.STAFF, UserRole.CLIENT])(
    "does not create an admin cookie for valid %s credentials",
    async (role) => {
      mocks.findUnique.mockResolvedValueOnce({
        ...admin,
        role,
        passwordHash: "stored-password-hash",
      });

      await expect(
        loginAdmin(admin.email, "valid-password")
      ).resolves.toBe(false);

      expect(mocks.compare).toHaveBeenCalledWith(
        "valid-password",
        "stored-password-hash"
      );
      expect(mocks.setCookie).not.toHaveBeenCalled();
    }
  );
});
