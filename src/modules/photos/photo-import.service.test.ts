import { beforeEach, describe, expect, it, vi } from "vitest";
import { GalleryStatus } from "@prisma/client";

const mocks = vi.hoisted(() => {
  const tx = { name: "transaction" };
  return {
    tx,
    db: {
      $transaction: vi.fn(),
    },
    gallery: {
      find: vi.fn(),
      findForUpdate: vi.fn(),
      event: vi.fn(),
    },
    storage: {
      buildRelativePhotoPath: vi.fn((...segments: string[]) => segments.join("/")),
      listImageFiles: vi.fn(),
    },
    photo: {
      findImportState: vi.fn(),
      upsertMany: vi.fn(),
    },
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/modules/galleries/gallery.repository", () => ({
  galleryRepository: mocks.gallery,
}));
vi.mock("@/modules/storage/storage.service", () => mocks.storage);
vi.mock("./photo.repository", () => ({ photoRepository: mocks.photo }));

import {
  importGalleryPhotos,
  PhotoImportValidationError,
} from "./photo-import.service";

const gallery = {
  id: "gallery-1",
  status: GalleryStatus.DRAFT,
  thumbnailLocalPath: "gallery-1/thumbs",
  previewLocalPath: null,
};

function storedPhoto(filename: string) {
  const baseName = filename.slice(0, filename.lastIndexOf("."));
  return {
    filename,
    baseName,
    relativePath: `gallery-1/thumbs/${filename}`,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.$transaction.mockImplementation(async (callback) => callback(mocks.tx));
  mocks.gallery.find.mockResolvedValue(gallery);
  mocks.gallery.findForUpdate.mockResolvedValue(gallery);
  mocks.gallery.event.mockResolvedValue({ id: "event-1" });
  mocks.storage.listImageFiles.mockResolvedValue([storedPhoto("01.jpg")]);
  mocks.photo.findImportState.mockResolvedValue([]);
  mocks.photo.upsertMany.mockResolvedValue(1);
});

describe("importGalleryPhotos", () => {
  it("persists the batch and its actor-aware event in one transaction", async () => {
    const result = await importGalleryPhotos("gallery-1", {
      actorType: "ADMIN",
      actorId: "admin-1",
    });

    expect(result).toEqual({
      importedCount: 1,
      updatedCount: 0,
      skippedCount: 0,
      totalProcessed: 1,
    });
    expect(mocks.gallery.findForUpdate).toHaveBeenCalledWith("gallery-1", mocks.tx);
    expect(mocks.photo.upsertMany).toHaveBeenCalledWith(
      [
        {
          galleryId: "gallery-1",
          filename: "01.jpg",
          baseName: "01",
          thumbPath: "gallery-1/thumbs/01.jpg",
          previewPath: null,
          sortOrder: 0,
        },
      ],
      mocks.tx
    );
    expect(mocks.gallery.event).toHaveBeenCalledWith(
      {
        galleryId: "gallery-1",
        type: "PHOTOS_IMPORTED",
        actorType: "ADMIN",
        actorId: "admin-1",
        metadata: {
          source: "local_filesystem",
          importedCount: 1,
          updatedCount: 0,
          skippedCount: 0,
          totalProcessed: 1,
        },
      },
      mocks.tx
    );
    expect(mocks.db.$transaction).toHaveBeenCalledOnce();
  });

  it("counts changed existing photos as updated and unchanged photos as skipped", async () => {
    mocks.storage.listImageFiles.mockResolvedValue([
      storedPhoto("01.jpg"),
      storedPhoto("02.jpg"),
    ]);
    mocks.photo.findImportState.mockResolvedValue([
      {
        baseName: "01",
        filename: "01.webp",
        thumbPath: "gallery-1/thumbs/01.webp",
        previewPath: null,
        sortOrder: 0,
      },
      {
        baseName: "02",
        filename: "02.jpg",
        thumbPath: "gallery-1/thumbs/02.jpg",
        previewPath: null,
        sortOrder: 1,
      },
    ]);

    const result = await importGalleryPhotos("gallery-1", { actorType: "SYSTEM" });

    expect(result).toEqual({
      importedCount: 0,
      updatedCount: 1,
      skippedCount: 1,
      totalProcessed: 2,
    });
    expect(mocks.photo.upsertMany).toHaveBeenCalledWith(
      [expect.objectContaining({ baseName: "01" })],
      mocks.tx
    );
    expect(mocks.gallery.event).toHaveBeenCalledOnce();
  });

  it("returns an empty result without writing or creating an event", async () => {
    mocks.storage.listImageFiles.mockResolvedValue([]);

    await expect(
      importGalleryPhotos("gallery-1", { actorType: "SYSTEM" })
    ).resolves.toEqual({
      importedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      totalProcessed: 0,
    });

    expect(mocks.db.$transaction).not.toHaveBeenCalled();
    expect(mocks.photo.upsertMany).not.toHaveBeenCalled();
    expect(mocks.gallery.event).not.toHaveBeenCalled();
  });

  it("treats an unchanged reimport as an idempotent no-op", async () => {
    mocks.photo.findImportState.mockResolvedValue([
      {
        baseName: "01",
        filename: "01.jpg",
        thumbPath: "gallery-1/thumbs/01.jpg",
        previewPath: null,
        sortOrder: 0,
      },
    ]);

    await expect(
      importGalleryPhotos("gallery-1", { actorType: "SYSTEM" })
    ).resolves.toEqual({
      importedCount: 0,
      updatedCount: 0,
      skippedCount: 1,
      totalProcessed: 1,
    });

    expect(mocks.photo.upsertMany).toHaveBeenCalledWith([], mocks.tx);
    expect(mocks.gallery.event).not.toHaveBeenCalled();
  });

  it("aborts discovery errors before opening a transaction", async () => {
    mocks.storage.listImageFiles.mockRejectedValueOnce(new Error("access denied"));

    await expect(
      importGalleryPhotos("gallery-1", { actorType: "SYSTEM" })
    ).rejects.toBeInstanceOf(PhotoImportValidationError);

    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an archived gallery before reading the filesystem", async () => {
    mocks.gallery.find.mockResolvedValueOnce({
      ...gallery,
      status: GalleryStatus.ARCHIVED,
    });

    await expect(
      importGalleryPhotos("gallery-1", { actorType: "SYSTEM" })
    ).rejects.toThrow("Archived galleries cannot import photos");

    expect(mocks.storage.listImageFiles).not.toHaveBeenCalled();
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });

  it("requires a non-empty actor id for administrative imports", async () => {
    await expect(
      importGalleryPhotos("gallery-1", { actorType: "ADMIN", actorId: " " })
    ).rejects.toThrow("Admin actorId is required");

    expect(mocks.gallery.find).not.toHaveBeenCalled();
    expect(mocks.storage.listImageFiles).not.toHaveBeenCalled();
  });

  it("rejects duplicate stable identifiers before opening a transaction", async () => {
    mocks.storage.listImageFiles.mockResolvedValue([
      storedPhoto("Photo.jpg"),
      storedPhoto("photo.webp"),
    ]);

    await expect(
      importGalleryPhotos("gallery-1", { actorType: "SYSTEM" })
    ).rejects.toThrow('Duplicate photo identifier "photo"');

    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });

  it("does not create an event after an upsert failure", async () => {
    mocks.photo.upsertMany.mockRejectedValueOnce(new Error("upsert failure"));

    await expect(
      importGalleryPhotos("gallery-1", { actorType: "SYSTEM" })
    ).rejects.toThrow("upsert failure");

    expect(mocks.gallery.event).not.toHaveBeenCalled();
  });

  it("rejects the operation when event creation fails", async () => {
    mocks.gallery.event.mockRejectedValueOnce(new Error("event failure"));

    await expect(
      importGalleryPhotos("gallery-1", { actorType: "SYSTEM" })
    ).rejects.toThrow("event failure");

    expect(mocks.photo.upsertMany).toHaveBeenCalledOnce();
  });
});
