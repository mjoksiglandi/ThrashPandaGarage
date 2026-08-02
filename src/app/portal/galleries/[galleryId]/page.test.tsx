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
  status: GalleryStatus.PROOFING as GalleryStatus,
  createdAt: new Date("2030-01-01T00:00:00.000Z"),
  deliveryDriveUrl: null as string | null,
  selectionOpen: true,
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
      { id: "photo-1", baseName: "beach-1", selected: false },
      { id: "photo-2", baseName: "beach-2", selected: false },
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
      { id: "photo-1", baseName: "beach-1", selected: false },
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

  it("reflects the persisted selected state on the control for each photo", async () => {
    mocks.listPortalGalleryPhotos.mockResolvedValueOnce([
      { id: "photo-1", baseName: "selected-photo", selected: true },
      { id: "photo-2", baseName: "unselected-photo", selected: false },
    ]);

    const element = await PortalGalleryDetailPage({
      params: Promise.resolve({ galleryId: "gallery-1" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("Seleccionada");
  });

  it("never renders accountId or clientId as manipulable fields", async () => {
    mocks.listPortalGalleryPhotos.mockResolvedValueOnce([
      { id: "photo-1", baseName: "beach-1", selected: false },
    ]);

    const element = await PortalGalleryDetailPage({
      params: Promise.resolve({ galleryId: "gallery-1" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).not.toContain("accountId");
    expect(html).not.toContain("clientId");
  });

  it("points the selection control at the authenticated route, not the public token endpoint", async () => {
    mocks.listPortalGalleryPhotos.mockResolvedValueOnce([
      { id: "photo-1", baseName: "beach-1", selected: false },
    ]);

    const element = await PortalGalleryDetailPage({
      params: Promise.resolve({ galleryId: "gallery-1" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("/api/portal/photos/photo-1");
    expect(html).not.toContain("/api/galleries/");
  });
});

describe("authenticated gallery delivery link", () => {
  async function renderWithGallery(overrides: Partial<typeof gallery>) {
    mocks.requirePortalGallery.mockResolvedValueOnce({
      actor: { kind: "account", accountId: "account-1", clientId: "client-1", email: "a@example.test" },
      gallery: { ...gallery, ...overrides },
    });
    const element = await PortalGalleryDetailPage({
      params: Promise.resolve({ galleryId: "gallery-1" }),
    });
    return renderToStaticMarkup(element);
  }

  it("shows the delivery link for READY_FOR_DELIVERY with a non-empty URL", async () => {
    const html = await renderWithGallery({
      status: GalleryStatus.READY_FOR_DELIVERY,
      deliveryDriveUrl: "https://drive.example.test/ready",
    });

    expect(html).toContain('href="https://drive.example.test/ready"');
  });

  it("shows the delivery link for DELIVERED with a non-empty URL", async () => {
    const html = await renderWithGallery({
      status: GalleryStatus.DELIVERED,
      deliveryDriveUrl: "https://drive.example.test/delivered",
    });

    expect(html).toContain('href="https://drive.example.test/delivered"');
  });

  it("hides the delivery link for a disallowed status even with a URL present", async () => {
    const html = await renderWithGallery({
      status: GalleryStatus.PROOFING,
      deliveryDriveUrl: "https://drive.example.test/ready",
    });

    expect(html).not.toContain("drive.example.test");
    expect(html).not.toContain("Ver entrega en Google Drive");
  });

  it("hides the delivery link when deliveryDriveUrl is null", async () => {
    const html = await renderWithGallery({
      status: GalleryStatus.READY_FOR_DELIVERY,
      deliveryDriveUrl: null,
    });

    expect(html).not.toContain("Ver entrega en Google Drive");
  });

  it("hides the delivery link when deliveryDriveUrl is an empty string", async () => {
    const html = await renderWithGallery({
      status: GalleryStatus.READY_FOR_DELIVERY,
      deliveryDriveUrl: "",
    });

    expect(html).not.toContain("Ver entrega en Google Drive");
  });

  it("hides the delivery link when deliveryDriveUrl is only whitespace", async () => {
    const html = await renderWithGallery({
      status: GalleryStatus.READY_FOR_DELIVERY,
      deliveryDriveUrl: "   ",
    });

    expect(html).not.toContain("Ver entrega en Google Drive");
  });

  it("preserves the closed behavior when the gallery is inaccessible", async () => {
    mocks.requirePortalGallery.mockRejectedValueOnce(new Error("not-found"));

    await expect(
      PortalGalleryDetailPage({
        params: Promise.resolve({ galleryId: "gallery-1" }),
      })
    ).rejects.toThrow("not-found");
    expect(mocks.listPortalGalleryPhotos).not.toHaveBeenCalled();
  });

  it("never renders accessToken in the delivery block markup", async () => {
    const html = await renderWithGallery({
      status: GalleryStatus.DELIVERED,
      deliveryDriveUrl: "https://drive.example.test/delivered",
    });

    expect(html).not.toContain("accessToken");
    expect(html).not.toContain("super-secret-token");
  });
});

describe("authenticated gallery selection controls", () => {
  async function renderWithGallery(
    overrides: Partial<typeof gallery>,
    selected = false
  ) {
    mocks.requirePortalGallery.mockResolvedValueOnce({
      actor: { kind: "account", accountId: "account-1", clientId: "client-1", email: "a@example.test" },
      gallery: { ...gallery, ...overrides },
    });
    mocks.listPortalGalleryPhotos.mockResolvedValueOnce([
      { id: "photo-1", baseName: "photo-1", selected },
    ]);
    const element = await PortalGalleryDetailPage({
      params: Promise.resolve({ galleryId: "gallery-1" }),
    });
    return renderToStaticMarkup(element);
  }

  it("renders selection controls while selection is open", async () => {
    const html = await renderWithGallery({ selectionOpen: true });

    expect(html).toContain('aria-label="Seleccionar foto"');
    expect(html).not.toContain("La selección está cerrada.");
  });

  it.each([
    [GalleryStatus.READY_FOR_DELIVERY, false],
    [GalleryStatus.DELIVERED, true],
  ] as const)("keeps photos and delivery visible without selection controls for %s", async (status, selected) => {
    const html = await renderWithGallery({
      status,
      selectionOpen: false,
      deliveryDriveUrl: "https://drive.example.test/delivery",
    }, selected);

    expect(html).toContain("/api/portal/photos/photo-1");
    expect(html).toContain('href="https://drive.example.test/delivery"');
    expect(html).toContain("La selección está cerrada.");
    expect(html).not.toContain('aria-label="Seleccionar foto"');
    expect(html).not.toContain('aria-label="Quitar selección"');
    expect(html).not.toContain("/g/");
    expect(html).not.toContain("super-secret-token");
  });
});
