import { GalleryStatus, type Selection } from "@prisma/client";
import { db } from "@/lib/db";
import {
  GalleryNotFoundError,
  GalleryUnavailableError,
  SelectionClosedError,
  SelectionCountMismatchError,
} from "@/modules/galleries/gallery.errors";
import { galleryRepository } from "@/modules/galleries/gallery.repository";
import { selectionRepository } from "@/modules/selections/selection.repository";

export async function setPortalPhotoSelection(
  galleryId: string,
  photoId: string,
  selected: boolean
): Promise<Selection> {
  return db.$transaction(async (tx) => {
    const locked = await galleryRepository.findForUpdate(galleryId, tx);
    if (!locked) throw new GalleryNotFoundError();
    if (locked.status === GalleryStatus.ARCHIVED) throw new GalleryUnavailableError();
    if (locked.expiresAt && locked.expiresAt <= new Date()) throw new GalleryUnavailableError();
    if (locked.status !== GalleryStatus.PROOFING) throw new SelectionClosedError();

    const photo = await tx.photo.findFirst({
      where: { id: photoId, galleryId: locked.id, status: { not: "REJECTED" } },
      select: { id: true },
    });
    if (!photo) throw new GalleryNotFoundError("Photo not found in gallery");

    if (selected && locked.selectionLimit !== null) {
      const current = await tx.selection.findUnique({
        where: { photoId },
        select: { selected: true },
      });
      if (!current?.selected) {
        const selectedCount = await selectionRepository.countSelected(locked.id, tx);
        if (selectedCount >= locked.selectionLimit) {
          throw new SelectionCountMismatchError("Selection limit reached");
        }
      }
    }

    return selectionRepository.setPhotoSelection(locked.id, photoId, selected, undefined, tx);
  });
}
