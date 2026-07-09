import { galleryRepository } from "@/modules/galleries/gallery.repository";
import { buildRelativePhotoPath, listImageFiles } from "@/modules/storage/storage.service";
import { photoRepository } from "./photo.repository";

export async function importGalleryPhotos(galleryId: string, galleryFolder?: string) {
  const gallery = await galleryRepository.find(galleryId);
  if (!gallery) throw new Error("Gallery not found");

  const thumbFolder = gallery.thumbnailLocalPath || (galleryFolder ? buildRelativePhotoPath(galleryFolder, "thumbs") : null);
  const previewFolder = gallery.previewLocalPath || (galleryFolder ? buildRelativePhotoPath(galleryFolder, "preview") : null);
  if (!thumbFolder) throw new Error("Gallery thumbnailLocalPath is required");

  const thumbs = await listImageFiles(thumbFolder);
  const previews = previewFolder ? await listImageFiles(previewFolder).catch(() => []) : [];
  const previewByBase = new Map(previews.map((file) => [file.baseName, file]));

  const imported = thumbs.map((thumb, index) => ({
    galleryId,
    filename: thumb.filename,
    baseName: thumb.baseName,
    thumbPath: thumb.relativePath,
    previewPath: previewByBase.get(thumb.baseName)?.relativePath ?? null,
    sortOrder: index,
  }));

  const count = await photoRepository.upsertMany(imported);
  await galleryRepository.event(galleryId, "PHOTOS_IMPORTED", { count });
  return { count };
}
