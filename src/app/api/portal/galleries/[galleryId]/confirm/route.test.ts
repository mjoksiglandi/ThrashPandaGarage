import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GalleryUnavailableError,
  SelectionCountMismatchError,
} from "@/modules/galleries/gallery.errors";

const mocks = vi.hoisted(() => ({
  authorizePortalGallery: vi.fn(),
  confirmPortalSelection: vi.fn(),
}));

vi.mock("@/modules/portal/portal-access", () => ({
  authorizePortalGallery: mocks.authorizePortalGallery,
}));
vi.mock("@/modules/portal/portal-selection.service", () => ({
  confirmPortalSelection: mocks.confirmPortalSelection,
}));

import { POST } from "./route";

const context = { params: Promise.resolve({ galleryId: "gallery-route" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorizePortalGallery.mockResolvedValue({
    actor: { kind: "account", accountId: "account-1", clientId: "client-1" },
    gallery: { id: "gallery-authorized" },
  });
  mocks.confirmPortalSelection.mockResolvedValue({
    galleryId: "gallery-authorized",
    status: "confirmed",
    selectedCount: 2,
    confirmedAt: new Date("2030-01-01T00:00:00.000Z"),
  });
});

describe("POST portal gallery confirmation", () => {
  it("confirms only the authorized gallery as the authenticated account", async () => {
    const response = await POST(new Request("http://localhost", { method: "POST" }), context);

    expect(mocks.authorizePortalGallery).toHaveBeenCalledWith("gallery-route");
    expect(mocks.confirmPortalSelection).toHaveBeenCalledWith(
      "gallery-authorized",
      expect.objectContaining({ accountId: "account-1", clientId: "client-1" })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      status: "confirmed",
      selectedCount: 2,
    });
  });

  it("returns a homogeneous 404 without mutation when account access fails", async () => {
    mocks.authorizePortalGallery.mockResolvedValueOnce(null);

    const response = await POST(new Request("http://localhost", { method: "POST" }), context);

    expect(response.status).toBe(404);
    expect(mocks.confirmPortalSelection).not.toHaveBeenCalled();
  });

  it("maps an incomplete exact-limit selection to 409", async () => {
    mocks.confirmPortalSelection.mockRejectedValueOnce(
      new SelectionCountMismatchError("Selected count must match the gallery limit")
    );

    const response = await POST(new Request("http://localhost", { method: "POST" }), context);

    expect(response.status).toBe(409);
  });

  it("maps an expired or archived gallery to 410", async () => {
    mocks.confirmPortalSelection.mockRejectedValueOnce(new GalleryUnavailableError());

    const response = await POST(new Request("http://localhost", { method: "POST" }), context);

    expect(response.status).toBe(410);
  });

  it("does not leak unexpected failures", async () => {
    mocks.confirmPortalSelection.mockRejectedValueOnce(new Error("database secret"));

    const response = await POST(new Request("http://localhost", { method: "POST" }), context);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Unexpected error",
    });
  });
});
