import { db } from "@/lib/db";
import type { DbClient } from "@/modules/galleries/gallery.repository";
import type { ImportedPhoto } from "./photo.types";

export const photoRepository = {
  find(id: string) {
    return db.photo.findUnique({ where: { id }, include: { gallery: true } });
  },
  async findImportState(galleryId: string, baseNames: string[], client: DbClient = db) {
    return client.photo.findMany({
      where: { galleryId, baseName: { in: baseNames } },
      select: {
        baseName: true,
        filename: true,
        thumbPath: true,
        previewPath: true,
        sortOrder: true,
      },
    });
  },
  async upsertMany(photos: ImportedPhoto[], client: DbClient = db) {
    for (const photo of photos) {
      await client.photo.upsert({
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
