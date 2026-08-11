import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GalleryNotFoundError,
  GalleryUnavailableError,
  SelectionClosedError,
  SelectionCountMismatchError,
} from "@/modules/galleries/gallery.errors";

const mocks = vi.hoisted(() => ({
  authorizePortalPhotoInGallery: vi.fn(),
  setPortalPhotoSelection: vi.fn(),
}));

vi.mock("@/modules/portal/portal-access", () => ({
  authorizePortalPhotoInGallery: mocks.authorizePortalPhotoInGallery,
}));
vi.mock("@/modules/portal/portal-selection.service", () => ({
  setPortalPhotoSelection: mocks.setPortalPhotoSelection,
}));

import { POST } from "./route";

const context = {
  params: Promise.resolve({ galleryId: "gallery-1", photoId: "photo-1" }),
};

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorizePortalPhotoInGallery.mockResolvedValue({
    gallery: { id: "gallery-1" },
    photo: { id: "photo-1" },
  });
  mocks.setPortalPhotoSelection.mockResolvedValue({
    id: "selection-1",
    galleryId: "gallery-1",
    photoId: "photo-1",
    selected: true,
    comment: null,
  });
});

describe("POST portal photo selection", () => {
  it("authorizes using only the route segments before reading the body", async () => {
    const request = jsonRequest({ selected: true });

    const response = await POST(request, context);

    expect(response.status).toBe(200);
    expect(mocks.authorizePortalPhotoInGallery).toHaveBeenCalledWith(
      "gallery-1",
      "photo-1"
    );
    await expect(response.json()).resolves.toEqual({
      ok: true,
      selected: true,
      comment: "",
    });
  });

  it("uses the authorized gallery and photo ids for the mutation, not client-controlled ones", async () => {
    const request = jsonRequest({
      selected: true,
      galleryId: "gallery-attacker",
      photoId: "photo-attacker",
      accountId: "account-attacker",
      clientId: "client-attacker",
      accessToken: "forged-token",
    });

    await POST(request, context);

    expect(mocks.setPortalPhotoSelection).toHaveBeenCalledWith(
      "gallery-1",
      "photo-1",
      true,
      undefined
    );
  });

  it("persists a bounded photo comment through the authorized selection", async () => {
    mocks.setPortalPhotoSelection.mockResolvedValueOnce({
      id: "selection-1",
      galleryId: "gallery-1",
      photoId: "photo-1",
      selected: true,
      comment: "Retocar fondo",
    });

    const response = await POST(
      jsonRequest({ selected: true, comment: "Retocar fondo" }),
      context
    );

    expect(mocks.setPortalPhotoSelection).toHaveBeenCalledWith(
      "gallery-1",
      "photo-1",
      true,
      "Retocar fondo"
    );
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      comment: "Retocar fondo",
    });
  });

  it("rejects comments beyond the shared 1000-character limit", async () => {
    const response = await POST(
      jsonRequest({ selected: true, comment: "x".repeat(1001) }),
      context
    );

    expect(response.status).toBe(400);
    expect(mocks.setPortalPhotoSelection).not.toHaveBeenCalled();
  });

  it("returns a homogeneous 404 and never mutates when authorization fails", async () => {
    mocks.authorizePortalPhotoInGallery.mockResolvedValueOnce(null);
    const request = jsonRequest({ selected: true });

    const response = await POST(request, context);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "Not found" });
    expect(mocks.setPortalPhotoSelection).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON without authorizing a mutation attempt", async () => {
    const request = new NextRequest("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    });

    const response = await POST(request, context);

    expect(response.status).toBe(400);
    expect(mocks.setPortalPhotoSelection).not.toHaveBeenCalled();
  });

  it("returns 400 for a payload missing the selected flag", async () => {
    const request = jsonRequest({});

    const response = await POST(request, context);

    expect(response.status).toBe(400);
    expect(mocks.setPortalPhotoSelection).not.toHaveBeenCalled();
  });

  it("selecting an already-selected photo is idempotent and returns 200", async () => {
    const request = jsonRequest({ selected: true });

    const response = await POST(request, context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      selected: true,
      comment: "",
    });
  });

  it("deselecting an already-deselected photo is idempotent and returns 200", async () => {
    mocks.setPortalPhotoSelection.mockResolvedValueOnce({
      id: "selection-1",
      galleryId: "gallery-1",
      photoId: "photo-1",
      selected: false,
      comment: null,
    });
    const request = jsonRequest({ selected: false });

    const response = await POST(request, context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      selected: false,
      comment: "",
    });
  });

  it("maps a closed selection window to 409 without leaking internal details", async () => {
    mocks.setPortalPhotoSelection.mockRejectedValueOnce(new SelectionClosedError());
    const request = jsonRequest({ selected: true });

    const response = await POST(request, context);

    expect(response.status).toBe(409);
  });

  it("maps a reached selection limit to 409", async () => {
    mocks.setPortalPhotoSelection.mockRejectedValueOnce(
      new SelectionCountMismatchError("Selection limit reached")
    );
    const request = jsonRequest({ selected: true });

    const response = await POST(request, context);

    expect(response.status).toBe(409);
  });

  it("maps an archived or expired gallery to 410", async () => {
    mocks.setPortalPhotoSelection.mockRejectedValueOnce(new GalleryUnavailableError());
    const request = jsonRequest({ selected: true });

    const response = await POST(request, context);

    expect(response.status).toBe(410);
  });

  it("maps a photo that raced out of the locked gallery to 404", async () => {
    mocks.setPortalPhotoSelection.mockRejectedValueOnce(new GalleryNotFoundError());
    const request = jsonRequest({ selected: true });

    const response = await POST(request, context);

    expect(response.status).toBe(404);
  });

  it("maps an unexpected mutation failure to a generic 500 without leaking details", async () => {
    mocks.setPortalPhotoSelection.mockRejectedValueOnce(new Error("db exploded: secret"));
    const request = jsonRequest({ selected: true });

    const response = await POST(request, context);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Unexpected error",
    });
  });
});
