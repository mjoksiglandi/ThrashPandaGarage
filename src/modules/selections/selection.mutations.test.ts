import { GalleryStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GalleryUnavailableError,
  SelectionClosedError,
} from "@/modules/galleries/gallery.errors";

const mocks = vi.hoisted(() => {
  const tx = {
    gallery: {
      findUnique: vi.fn(),
    },
  };
  return {
    tx,
    db: {
      $transaction: vi.fn(),
    },
    gallery: {
      findByTokenForUpdate: vi.fn(),
      update: vi.fn(),
      event: vi.fn(),
    },
    selection: {
      countSelected: vi.fn(),
      setPhotoSelection: vi.fn(),
      selectedForGallery: vi.fn(),
    },
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/modules/galleries/gallery.repository", () => ({
  galleryRepository: mocks.gallery,
}));
vi.mock("./selection.repository", () => ({
  selectionRepository: mocks.selection,
}));

import {
  confirmSelection,
  updateSelectionFromClient,
} from "./selection.service";

const confirmedAt = new Date("2026-07-24T01:00:00.000Z");
const lockedGallery = {
  id: "gallery-1",
  status: GalleryStatus.PROOFING,
  expiresAt: null,
  selectionLimit: 1,
  selectionConfirmedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.$transaction.mockImplementation(async (callback) => callback(mocks.tx));
  mocks.gallery.findByTokenForUpdate.mockResolvedValue(lockedGallery);
  mocks.tx.gallery.findUnique.mockResolvedValue({
    ...lockedGallery,
    photos: [{ id: "photo-1" }],
    selections: [],
  });
  mocks.selection.countSelected.mockResolvedValue(1);
  mocks.selection.setPhotoSelection.mockResolvedValue({
    id: "selection-1",
    galleryId: lockedGallery.id,
    photoId: "photo-1",
    selected: true,
    comment: null,
  });
});

describe("selection client mutations", () => {
  it("strips status and audit fields injected by the client", async () => {
    mocks.selection.countSelected.mockResolvedValueOnce(0);

    await updateSelectionFromClient("token", {
      photoId: "photo-1",
      selected: true,
      comment: "keep",
      status: GalleryStatus.ARCHIVED,
      actorId: "forged-actor",
      metadata: { actorType: "ADMIN" },
    });

    expect(mocks.selection.setPhotoSelection).toHaveBeenCalledWith(
      lockedGallery.id,
      "photo-1",
      true,
      "keep",
      mocks.tx
    );
  });

  it("rejects an expired gallery as unavailable before reading photos", async () => {
    mocks.gallery.findByTokenForUpdate.mockResolvedValueOnce({
      ...lockedGallery,
      expiresAt: new Date("2020-01-01T00:00:00.000Z"),
    });

    await expect(
      updateSelectionFromClient("token", {
        photoId: "photo-1",
        selected: true,
      })
    ).rejects.toBeInstanceOf(GalleryUnavailableError);

    expect(mocks.tx.gallery.findUnique).not.toHaveBeenCalled();
    expect(mocks.selection.setPhotoSelection).not.toHaveBeenCalled();
  });

  it("rejects an archived gallery as unavailable before reading photos", async () => {
    mocks.gallery.findByTokenForUpdate.mockResolvedValueOnce({
      ...lockedGallery,
      status: GalleryStatus.ARCHIVED,
    });

    await expect(
      updateSelectionFromClient("token", {
        photoId: "photo-1",
        selected: true,
      })
    ).rejects.toBeInstanceOf(GalleryUnavailableError);

    expect(mocks.tx.gallery.findUnique).not.toHaveBeenCalled();
    expect(mocks.selection.setPhotoSelection).not.toHaveBeenCalled();
  });
});

describe("selection confirmation availability", () => {
  it("keeps public confirmation attributed to the gallery token", async () => {
    await expect(confirmSelection("token")).resolves.toMatchObject({
      galleryId: lockedGallery.id,
      status: "confirmed",
      selectedCount: 1,
    });
    expect(mocks.gallery.event).toHaveBeenCalledWith(
      expect.objectContaining({
        galleryId: lockedGallery.id,
        type: "SELECTION_CONFIRMED",
        actorType: "GALLERY_TOKEN",
      }),
      mocks.tx
    );
  });

  it("rejects an archived gallery even when it was confirmed previously", async () => {
    mocks.gallery.findByTokenForUpdate.mockResolvedValueOnce({
      ...lockedGallery,
      status: GalleryStatus.ARCHIVED,
      selectionConfirmedAt: confirmedAt,
    });

    await expect(confirmSelection("token")).rejects.toBeInstanceOf(
      GalleryUnavailableError
    );
    expect(mocks.selection.countSelected).not.toHaveBeenCalled();
  });

  it("rejects an expired gallery before returning idempotent success", async () => {
    mocks.gallery.findByTokenForUpdate.mockResolvedValueOnce({
      ...lockedGallery,
      status: GalleryStatus.SELECTION_CONFIRMED,
      expiresAt: new Date("2020-01-01T00:00:00.000Z"),
      selectionConfirmedAt: confirmedAt,
    });

    await expect(confirmSelection("token")).rejects.toBeInstanceOf(
      GalleryUnavailableError
    );
    expect(mocks.selection.countSelected).not.toHaveBeenCalled();
  });

  it("returns an explicit committed retry without a second write or event", async () => {
    mocks.gallery.findByTokenForUpdate.mockResolvedValueOnce({
      ...lockedGallery,
      status: GalleryStatus.SELECTION_CONFIRMED,
      selectionConfirmedAt: confirmedAt,
    });

    await expect(confirmSelection("token")).resolves.toEqual({
      galleryId: lockedGallery.id,
      status: "already_confirmed",
      selectedCount: 1,
      confirmedAt,
    });
    expect(mocks.gallery.update).not.toHaveBeenCalled();
    expect(mocks.gallery.event).not.toHaveBeenCalled();
  });

  it("rejects a closed unconfirmed state as a domain error", async () => {
    mocks.gallery.findByTokenForUpdate.mockResolvedValueOnce({
      ...lockedGallery,
      status: GalleryStatus.EDITING,
    });

    await expect(confirmSelection("token")).rejects.toBeInstanceOf(
      SelectionClosedError
    );
  });
});
