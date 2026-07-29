import { GalleryStatus } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePortalGallery: vi.fn(),
  listPortalGalleryPhotos: vi.fn(),
}));

vi.mock("@/modules/portal/portal-access", () => ({
  requirePortalGallery: mocks.requirePortalGallery,
  listPortalGalleryPhotos: mocks.listPortalGalleryPhotos,
}));

import PortalGalleryDetailPage from "./page";

const gallery = {
  id: "gallery-1",
  title: "Sesión de Verano",
  accessToken: "super-secret-token",
  status: GalleryStatus.PROOFING,
  createdAt: new Date("2030-01-01T00:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePortalGallery.mockResolvedValue({
    actor: { kind: "account", accountId: "account-1", clientId: "client-1", email: "a@example.test" },
    gallery,
  });
  mocks.listPortalGalleryPhotos.mockResolvedValue([]);
});

describe("authenticated gallery detail page", () => {
  it("resolves the gallery through the canonical requirePortalGallery boundary", async () => {
    await PortalGalleryDetailPage({
      params: Promise.resolve({ galleryId: "gallery-1" }),
    });

    expect(mocks.requirePortalGallery).toHaveBeenCalledWith("gallery-1");
  });

  it("only queries photos after the gallery has been authorized", async () => {
    const callOrder: string[] = [];
    mocks.requirePortalGallery.mockImplementationOnce(async () => {
      callOrder.push("requirePortalGallery");
      return {
        actor: { kind: "account", accountId: "account-1", clientId: "client-1", email: "a@example.test" },
        gallery,
      };
    });
    mocks.listPortalGalleryPhotos.mockImplementationOnce(async () => {
      callOrder.push("listPortalGalleryPhotos");
      return [];
    });

    await PortalGalleryDetailPage({
      params: Promise.resolve({ galleryId: "gallery-1" }),
    });

    expect(callOrder).toEqual(["requirePortalGallery", "listPortalGalleryPhotos"]);
    expect(mocks.listPortalGalleryPhotos).toHaveBeenCalledWith("gallery-1");
  });

  it("renders the gallery title and status without leaking the accessToken", async () => {
    const element = await PortalGalleryDetailPage({
      params: Promise.resolve({ galleryId: "gallery-1" }),
    });

    const html = renderToStaticMarkup(element);

    expect(html).toContain("Sesión de Verano");
    expect(html).toContain("Selección abierta");
    expect(html).not.toContain("super-secret-token");
    expect(html).not.toContain("accessToken");
  });

  it("renders only the authorized gallery's photos in a deterministic order", async () => {
    mocks.listPortalGalleryPhotos.mockResolvedValueOnce([
      { id: "photo-1", baseName: "beach-1" },
      { id: "photo-2", baseName: "beach-2" },
    ]);

    const element = await PortalGalleryDetailPage({
      params: Promise.resolve({ galleryId: "gallery-1" }),
    });
    const html = renderToStaticMarkup(element);

    const firstIndex = html.indexOf("/api/portal/photos/photo-1");
    const secondIndex = html.indexOf("/api/portal/photos/photo-2");
    expect(firstIndex).toBeGreaterThan(-1);
    expect(secondIndex).toBeGreaterThan(firstIndex);
    expect(html).toContain('alt="beach-1"');
    expect(html).toContain('alt="beach-2"');
  });

  it("renders a clear empty state when the gallery has no available photos", async () => {
    mocks.listPortalGalleryPhotos.mockResolvedValueOnce([]);

    const element = await PortalGalleryDetailPage({
      params: Promise.resolve({ galleryId: "gallery-1" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Aún no hay fotografías disponibles.");
  });

  it("never renders the public token contract inside the authenticated portal", async () => {
    mocks.listPortalGalleryPhotos.mockResolvedValueOnce([
      { id: "photo-1", baseName: "beach-1" },
    ]);

    const element = await PortalGalleryDetailPage({
      params: Promise.resolve({ galleryId: "gallery-1" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).not.toContain("/g/");
    expect(html).not.toContain("accessToken");
    expect(html).not.toContain("super-secret-token");
    expect(html).not.toContain("token=");
  });
});
