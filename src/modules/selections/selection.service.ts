import { GalleryStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { selectionSchema } from "@/lib/validators";
import { markSelectionConfirmed } from "@/modules/galleries/gallery.service";
import { selectionRepository } from "./selection.repository";

export async function updateSelectionFromClient(accessToken: string, input: unknown) {
  const parsed = selectionSchema.parse(input);
  const gallery = await db.gallery.findUnique({
    where: { accessToken },
    include: { photos: true, selections: true },
  });
  if (!gallery || gallery.status === GalleryStatus.ARCHIVED) throw new Error("Gallery not available");
  if (gallery.expiresAt && gallery.expiresAt < new Date()) throw new Error("Gallery expired");

  const belongs = gallery.photos.some((photo) => photo.id === parsed.photoId);
  if (!belongs) throw new Error("Invalid photo");

  if (parsed.selected && gallery.selectionLimit) {
    const selectedCount = gallery.selections.filter((item) => item.selected && item.photoId !== parsed.photoId).length;
    if (selectedCount >= gallery.selectionLimit) throw new Error("Selection limit reached");
  }

  return selectionRepository.setPhotoSelection(gallery.id, parsed.photoId, parsed.selected, parsed.comment);
}

export async function confirmSelection(accessToken: string) {
  const gallery = await db.gallery.findUnique({ where: { accessToken } });
  if (!gallery || gallery.status === GalleryStatus.ARCHIVED) throw new Error("Gallery not available");
  await markSelectionConfirmed(gallery.id);
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
    ...selected.map((item) => item.photo.baseName),
    "",
  ].join("\n");
}
