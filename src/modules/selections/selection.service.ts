import { db } from "@/lib/db";
import { selectionSchema } from "@/lib/validators";
import { isGalleryAccessible, markSelectionConfirmed } from "@/modules/galleries/gallery.service";
import { selectionRepository } from "./selection.repository";

export async function updateSelectionFromClient(accessToken: string, input: unknown) {
  const parsed = selectionSchema.parse(input);
  const gallery = await db.gallery.findUnique({
    where: { accessToken },
    include: { photos: true, selections: true },
  });
  if (!gallery || !isGalleryAccessible(gallery)) throw new Error("Gallery not available");

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
  if (!gallery || !isGalleryAccessible(gallery)) throw new Error("Gallery not available");
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
