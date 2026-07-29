import { GalleryStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GalleryNotFoundError,
  GalleryUnavailableError,
  SelectionClosedError,
  SelectionCountMismatchError,
} from "@/modules/galleries/gallery.errors";

const mocks = vi.hoisted(() => {
  const tx = {
    photo: { findFirst: vi.fn() },
    selection: { findUnique: vi.fn() },
  };
  return {
    tx,
    db: { $transaction: vi.fn() },
    gallery: { findForUpdate: vi.fn() },
    selection: { countSelected: vi.fn(), setPhotoSelection: vi.fn() },
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/modules/galleries/gallery.repository", () => ({
  galleryRepository: mocks.gallery,
}));
vi.mock("@/modules/selections/selection.repository", () => ({
  selectionRepository: mocks.selection,
}));

import { setPortalPhotoSelection } from "./portal-selection.service";

const lockedGallery = {
  id: "gallery-1",
  status: GalleryStatus.PROOFING,
  expiresAt: null,
  selectionLimit: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
    callback(mocks.tx)
  );
  mocks.gallery.findForUpdate.mockResolvedValue(lockedGallery);
  mocks.tx.photo.findFirst.mockResolvedValue({ id: "photo-1" });
  mocks.tx.selection.findUnique.mockResolvedValue(null);
  mocks.selection.countSelected.mockResolvedValue(0);
  mocks.selection.setPhotoSelection.mockResolvedValue({
    id: "selection-1",
    galleryId: "gallery-1",
    photoId: "photo-1",
    selected: true,
    comment: null,
  });
});

describe("setPortalPhotoSelection", () => {
  it("selects an authorized photo through the shared persistence primitive", async () => {
    await setPortalPhotoSelection("gallery-1", "photo-1", true);

    expect(mocks.selection.setPhotoSelection).toHaveBeenCalledWith(
      "gallery-1",
      "photo-1",
      true,
      undefined,
      mocks.tx
    );
  });

  it("deselects an authorized photo through the shared persistence primitive", async () => {
    mocks.tx.selection.findUnique.mockResolvedValue({ selected: true });

    await setPortalPhotoSelection("gallery-1", "photo-1", false);

    expect(mocks.selection.setPhotoSelection).toHaveBeenCalledWith(
      "gallery-1",
      "photo-1",
      false,
      undefined,
      mocks.tx
    );
    expect(mocks.selection.countSelected).not.toHaveBeenCalled();
  });

  it("is idempotent when selecting a photo that is already selected, even at the limit", async () => {
    mocks.tx.selection.findUnique.mockResolvedValue({ selected: true });
    mocks.selection.countSelected.mockResolvedValue(1);

    await expect(
      setPortalPhotoSelection("gallery-1", "photo-1", true)
    ).resolves.toMatchObject({ selected: true });
    expect(mocks.selection.setPhotoSelection).toHaveBeenCalledWith(
      "gallery-1",
      "photo-1",
      true,
      undefined,
      mocks.tx
    );
  });

  it("is idempotent when deselecting a photo that is already deselected", async () => {
    mocks.selection.setPhotoSelection.mockResolvedValueOnce({
      id: "selection-1",
      galleryId: "gallery-1",
      photoId: "photo-1",
      selected: false,
      comment: null,
    });

    await expect(
      setPortalPhotoSelection("gallery-1", "photo-1", false)
    ).resolves.toMatchObject({ selected: false });
  });

  it("rejects selection once the gallery's selection limit is reached", async () => {
    mocks.selection.countSelected.mockResolvedValue(1);

    await expect(
      setPortalPhotoSelection("gallery-1", "photo-1", true)
    ).rejects.toBeInstanceOf(SelectionCountMismatchError);
    expect(mocks.selection.setPhotoSelection).not.toHaveBeenCalled();
  });

  it("rejects mutation for an archived gallery before touching the photo", async () => {
    mocks.gallery.findForUpdate.mockResolvedValueOnce({
      ...lockedGallery,
      status: GalleryStatus.ARCHIVED,
    });

    await expect(
      setPortalPhotoSelection("gallery-1", "photo-1", true)
    ).rejects.toBeInstanceOf(GalleryUnavailableError);
    expect(mocks.tx.photo.findFirst).not.toHaveBeenCalled();
    expect(mocks.selection.setPhotoSelection).not.toHaveBeenCalled();
  });

  it("rejects mutation for an expired gallery before touching the photo", async () => {
    mocks.gallery.findForUpdate.mockResolvedValueOnce({
      ...lockedGallery,
      expiresAt: new Date("2020-01-01T00:00:00.000Z"),
    });

    await expect(
      setPortalPhotoSelection("gallery-1", "photo-1", true)
    ).rejects.toBeInstanceOf(GalleryUnavailableError);
    expect(mocks.tx.photo.findFirst).not.toHaveBeenCalled();
    expect(mocks.selection.setPhotoSelection).not.toHaveBeenCalled();
  });

  it("rejects mutation once the gallery has left the proofing state", async () => {
    mocks.gallery.findForUpdate.mockResolvedValueOnce({
      ...lockedGallery,
      status: GalleryStatus.SELECTION_CONFIRMED,
    });

    await expect(
      setPortalPhotoSelection("gallery-1", "photo-1", true)
    ).rejects.toBeInstanceOf(SelectionClosedError);
    expect(mocks.selection.setPhotoSelection).not.toHaveBeenCalled();
  });

  it("rejects mutation when the gallery no longer exists", async () => {
    mocks.gallery.findForUpdate.mockResolvedValueOnce(null);

    await expect(
      setPortalPhotoSelection("gallery-1", "photo-1", true)
    ).rejects.toBeInstanceOf(GalleryNotFoundError);
  });

  it("rejects mutation when the photo no longer belongs to the locked gallery", async () => {
    mocks.tx.photo.findFirst.mockResolvedValueOnce(null);

    await expect(
      setPortalPhotoSelection("gallery-1", "photo-1", true)
    ).rejects.toBeInstanceOf(GalleryNotFoundError);
    expect(mocks.selection.setPhotoSelection).not.toHaveBeenCalled();
  });

  it("excludes rejected photos from the locked-gallery membership query", async () => {
    await setPortalPhotoSelection("gallery-1", "photo-1", true);

    expect(mocks.tx.photo.findFirst).toHaveBeenCalledWith({
      where: { id: "photo-1", galleryId: "gallery-1", status: { not: "REJECTED" } },
      select: { id: true },
    });
  });
});
