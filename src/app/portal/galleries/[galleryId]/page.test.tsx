import { GalleryStatus } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePortalGallery: vi.fn(),
}));

vi.mock("@/modules/portal/portal-access", () => ({
  requirePortalGallery: mocks.requirePortalGallery,
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
});

describe("authenticated gallery detail page", () => {
  it("resolves the gallery through the canonical requirePortalGallery boundary", async () => {
    await PortalGalleryDetailPage({
      params: Promise.resolve({ galleryId: "gallery-1" }),
    });

    expect(mocks.requirePortalGallery).toHaveBeenCalledWith("gallery-1");
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
});
