import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  countByStatus: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  logoutAdmin: vi.fn(),
  requireAdmin: mocks.requireAdmin,
}));
vi.mock("@/modules/galleries/gallery.repository", () => ({
  galleryRepository: { countByStatus: mocks.countByStatus },
}));
vi.mock("./AdminSidebar", () => ({ AdminSidebar: () => null }));

import { AdminShell } from "./AdminShell";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ email: "admin@example.test" });
  mocks.countByStatus.mockResolvedValue(0);
});

describe("AdminShell", () => {
  it("authenticates before reading the sidebar count", async () => {
    await AdminShell({ children: null });

    expect(mocks.requireAdmin.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.countByStatus.mock.invocationCallOrder[0]
    );
  });

  it("does not read the sidebar count when authentication fails", async () => {
    mocks.requireAdmin.mockRejectedValueOnce(new Error("unauthorized"));

    await expect(AdminShell({ children: null })).rejects.toThrow("unauthorized");

    expect(mocks.countByStatus).not.toHaveBeenCalled();
  });
});
