import { db } from "@/lib/db";
import type { ImportedPhoto } from "./photo.types";

export const photoRepository = {
  find(id: string) {
    return db.photo.findUnique({ where: { id }, include: { gallery: true } });
  },
  async upsertMany(photos: ImportedPhoto[]) {
    for (const photo of photos) {
      await db.photo.upsert({
        where: { galleryId_baseName: { galleryId: photo.galleryId, baseName: photo.baseName } },
        update: {
          filename: photo.filename,
          thumbPath: photo.thumbPath,
          previewPath: photo.previewPath,
          sortOrder: photo.sortOrder,
        },
        create: photo,
      });
    }
    return photos.length;
  },
};
