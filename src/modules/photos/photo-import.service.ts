import { GalleryStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { GalleryUnavailableError } from "@/modules/galleries/gallery.errors";
import { galleryRepository } from "@/modules/galleries/gallery.repository";
import { buildRelativePhotoPath, listImageFiles } from "@/modules/storage/storage.service";
import type { StoredPhotoFile } from "@/modules/storage/storage.types";
import { photoRepository } from "./photo.repository";
import type { ImportedPhoto } from "./photo.types";

export type ImportActor =
  | { actorType: "ADMIN"; actorId: string }
  | { actorType: "SYSTEM"; actorId?: never };

export type PhotoImportResult = {
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  totalProcessed: number;
};

export class PhotoImportValidationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PhotoImportValidationError";
  }
}

function normalizeDiscoveredFiles(files: StoredPhotoFile[], label: string) {
  const normalized = files.map((file) => ({
    ...file,
    filename: file.filename.normalize("NFC"),
    baseName: file.baseName.normalize("NFC"),
  }));
  const identifiers = new Set<string>();

  for (const file of normalized) {
    const identifier = file.baseName.toLowerCase();
    if (identifiers.has(identifier)) {
      throw new PhotoImportValidationError(
        `Duplicate photo identifier "${file.baseName}" in configured ${label} folder`
      );
    }
    identifiers.add(identifier);
  }

  return normalized;
}

async function discoverFiles(relativeFolder: string, label: string) {
  try {
    return normalizeDiscoveredFiles(
      await listImageFiles(relativeFolder, { rejectUnsupported: true }),
      label
    );
  } catch (error) {
    if (error instanceof PhotoImportValidationError) throw error;
    throw new PhotoImportValidationError(
      `Unable to validate configured ${label} photo folder`,
      { cause: error }
    );
  }
}

function hasImportChanges(
  existing: {
    filename: string;
    thumbPath: string;
    previewPath: string | null;
    sortOrder: number;
  },
  discovered: ImportedPhoto
) {
  return (
    existing.filename !== discovered.filename ||
    existing.thumbPath !== discovered.thumbPath ||
    existing.previewPath !== (discovered.previewPath ?? null) ||
    existing.sortOrder !== discovered.sortOrder
  );
}

export async function importGalleryPhotos(
  galleryId: string,
  actor: ImportActor,
  galleryFolder?: string
): Promise<PhotoImportResult> {
  if (actor.actorType === "ADMIN" && !actor.actorId.trim()) {
    throw new Error("Admin actorId is required");
  }

  const gallery = await galleryRepository.find(galleryId);
  if (!gallery) throw new Error("Gallery not found");
  if (gallery.status === GalleryStatus.ARCHIVED) {
    throw new GalleryUnavailableError("Archived galleries cannot import photos");
  }

  const thumbFolder = gallery.thumbnailLocalPath || (galleryFolder ? buildRelativePhotoPath(galleryFolder, "thumbs") : null);
  const previewFolder = gallery.previewLocalPath || (galleryFolder ? buildRelativePhotoPath(galleryFolder, "preview") : null);
  if (!thumbFolder) throw new Error("Gallery thumbnailLocalPath is required");

  const thumbs = await discoverFiles(thumbFolder, "thumbnail");
  const previews = previewFolder ? await discoverFiles(previewFolder, "preview") : [];
  const previewByBase = new Map(
    previews.map((file) => [file.baseName.toLowerCase(), file])
  );

  const discovered: ImportedPhoto[] = thumbs.map((thumb, index) => ({
    galleryId,
    filename: thumb.filename,
    baseName: thumb.baseName,
    thumbPath: thumb.relativePath,
    previewPath: previewByBase.get(thumb.baseName.toLowerCase())?.relativePath ?? null,
    sortOrder: index,
  }));

  if (discovered.length === 0) {
    return {
      importedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      totalProcessed: 0,
    };
  }

  return db.$transaction(async (tx) => {
    const lockedGallery = await galleryRepository.findForUpdate(galleryId, tx);
    if (!lockedGallery) throw new Error("Gallery not found");
    if (lockedGallery.status === GalleryStatus.ARCHIVED) {
      throw new GalleryUnavailableError("Archived galleries cannot import photos");
    }
    if (
      lockedGallery.thumbnailLocalPath !== gallery.thumbnailLocalPath ||
      lockedGallery.previewLocalPath !== gallery.previewLocalPath
    ) {
      throw new PhotoImportValidationError(
        "Gallery photo folder configuration changed during discovery; retry the import"
      );
    }

    const existingPhotos = await photoRepository.findImportState(
      galleryId,
      discovered.map((photo) => photo.baseName),
      tx
    );
    const existingByBaseName = new Map(existingPhotos.map((photo) => [photo.baseName, photo]));
    const photosToPersist: ImportedPhoto[] = [];
    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const photo of discovered) {
      const existing = existingByBaseName.get(photo.baseName);
      if (!existing) {
        importedCount += 1;
        photosToPersist.push(photo);
      } else if (hasImportChanges(existing, photo)) {
        updatedCount += 1;
        photosToPersist.push(photo);
      } else {
        skippedCount += 1;
      }
    }

    await photoRepository.upsertMany(photosToPersist, tx);

    const result: PhotoImportResult = {
      importedCount,
      updatedCount,
      skippedCount,
      totalProcessed: discovered.length,
    };

    if (importedCount > 0 || updatedCount > 0) {
      await galleryRepository.event(
        {
          galleryId,
          type: "PHOTOS_IMPORTED",
          actorType: actor.actorType,
          actorId: actor.actorId,
          metadata: {
            source: "local_filesystem",
            ...result,
          },
        },
        tx
      );
    }

    return result;
  });
}
