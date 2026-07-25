import { GalleryStatus, type Selection } from "@prisma/client";
import { db } from "@/lib/db";
import { selectionSchema } from "@/lib/validators";
import {
  GalleryNotFoundError,
  GalleryUnavailableError,
  SelectionClosedError,
  SelectionCountMismatchError,
} from "@/modules/galleries/gallery.errors";
import { galleryRepository } from "@/modules/galleries/gallery.repository";
import { hasConfirmedSelection } from "@/modules/galleries/gallery-workflow";
import { selectionRepository } from "./selection.repository";

export async function updateSelectionFromClient(accessToken: string, input: unknown): Promise<Selection> {
  const parsed = selectionSchema.parse(input);

  return db.$transaction(async (tx) => {
    const locked = await galleryRepository.findByTokenForUpdate(accessToken, tx);
    if (!locked) throw new GalleryNotFoundError();
    if (locked.status === GalleryStatus.ARCHIVED) throw new GalleryUnavailableError();
    if (locked.expiresAt && locked.expiresAt <= new Date()) throw new GalleryUnavailableError();
    if (locked.status !== GalleryStatus.PROOFING) throw new SelectionClosedError();

    const gallery = await tx.gallery.findUnique({
      where: { id: locked.id },
      include: { photos: true, selections: true },
    });
    if (!gallery) throw new GalleryNotFoundError();

    const belongs = gallery.photos.some((photo) => photo.id === parsed.photoId);
    if (!belongs) throw new GalleryNotFoundError("Photo not found in gallery");

    const currentSelection = gallery.selections.find((item) => item.photoId === parsed.photoId);
    if (parsed.selected && !currentSelection?.selected && gallery.selectionLimit !== null) {
      const selectedCount = await selectionRepository.countSelected(gallery.id, tx);
      if (selectedCount >= gallery.selectionLimit) throw new SelectionCountMismatchError("Selection limit reached");
    }

    return selectionRepository.setPhotoSelection(gallery.id, parsed.photoId, parsed.selected, parsed.comment, tx);
  });
}

export type ConfirmSelectionResult = {
  galleryId: string;
  status: "confirmed" | "already_confirmed";
  selectedCount: number;
  confirmedAt: Date;
};

export async function confirmSelection(accessToken: string): Promise<ConfirmSelectionResult> {
  return db.$transaction(async (tx) => {
    const locked = await galleryRepository.findByTokenForUpdate(accessToken, tx);
    if (!locked) throw new GalleryNotFoundError();

    if (locked.status === GalleryStatus.ARCHIVED) throw new GalleryUnavailableError();
    if (locked.expiresAt && locked.expiresAt <= new Date()) throw new GalleryUnavailableError();

    const selectedCount = await selectionRepository.countSelected(locked.id, tx);
    if (hasConfirmedSelection(locked)) {
      const confirmedAt = locked.selectionConfirmedAt;
      if (!confirmedAt) throw new SelectionClosedError();
      return {
        galleryId: locked.id,
        status: "already_confirmed",
        selectedCount,
        confirmedAt,
      };
    }

    if (locked.status !== GalleryStatus.PROOFING) throw new SelectionClosedError();
    if (selectedCount === 0) throw new SelectionCountMismatchError("Select at least one photo");
    if (locked.selectionLimit !== null && selectedCount !== locked.selectionLimit) {
      throw new SelectionCountMismatchError("Selected count must match the gallery limit");
    }

    const confirmedAt = new Date();
    await galleryRepository.update(
      locked.id,
      { status: GalleryStatus.SELECTION_CONFIRMED, selectionConfirmedAt: confirmedAt },
      tx
    );
    await galleryRepository.event(
      {
        galleryId: locked.id,
        type: "SELECTION_CONFIRMED",
        actorType: "GALLERY_TOKEN",
        metadata: {
          selectedCount,
          fromStatus: locked.status,
          toStatus: GalleryStatus.SELECTION_CONFIRMED,
        },
      },
      tx
    );

    return { galleryId: locked.id, status: "confirmed", selectedCount, confirmedAt };
  });
}

export async function exportSelectionText(galleryId: string) {
  const gallery = await db.gallery.findUnique({ where: { id: galleryId }, include: { client: true } });
  if (!gallery) throw new Error("Gallery not found");
  const selected = await selectionRepository.selectedForGallery(galleryId);
  return [
    `Gallery: ${gallery.title}`,
    `Client: ${gallery.client.name}`,
    `Selected: ${selected.length}`,
    "",
    ...selected.map((item) =>
      item.comment ? `${item.photo.baseName} — ${item.comment}` : item.photo.baseName
    ),
    "",
  ].join("\n");
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function exportSelectionCsv(galleryId: string): Promise<string> {
  const selected = await selectionRepository.selectedForGallery(galleryId);
  const header = "filename,baseName,comment";
  const rows = selected.map((item) =>
    [item.photo.filename, item.photo.baseName, csvEscape(item.comment ?? "")].join(",")
  );
  return [header, ...rows].join("\n");
}
