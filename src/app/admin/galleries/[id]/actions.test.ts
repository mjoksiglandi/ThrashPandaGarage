import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  importGalleryPhotos: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/modules/photos/photo-import.service", () => ({
  importGalleryPhotos: mocks.importGalleryPhotos,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { importGalleryPhotosAction } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({
    id: "admin-1",
    email: "admin@example.com",
    role: "ADMIN",
  });
  mocks.importGalleryPhotos.mockResolvedValue({
    importedCount: 1,
    updatedCount: 0,
    skippedCount: 0,
    totalProcessed: 1,
  });
});

describe("importGalleryPhotosAction", () => {
  it("authenticates before importing and propagates the admin actor", async () => {
    await importGalleryPhotosAction("gallery-1");

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.importGalleryPhotos).toHaveBeenCalledWith("gallery-1", {
      actorType: "ADMIN",
      actorId: "admin-1",
    });
    expect(mocks.requireAdmin.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.importGalleryPhotos.mock.invocationCallOrder[0]
    );
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/admin/galleries/gallery-1?success=imported&imported=1&updated=0&skipped=0"
    );
  });

  it("does not touch the import service when authentication fails", async () => {
    mocks.requireAdmin.mockRejectedValueOnce(new Error("unauthorized"));

    await expect(importGalleryPhotosAction("gallery-1")).rejects.toThrow("unauthorized");

    expect(mocks.importGalleryPhotos).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects to actionable feedback when importing fails", async () => {
    mocks.importGalleryPhotos.mockRejectedValueOnce(new Error("storage unavailable"));

    await importGalleryPhotosAction("gallery-1");

    const target = mocks.redirect.mock.calls[0][0] as string;
    expect(target).toContain("/admin/galleries/gallery-1?error=");
    expect(decodeURIComponent(target)).toContain("Revisa las rutas configuradas");
  });
});
