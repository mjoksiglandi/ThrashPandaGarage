import { db } from "@/lib/db";
import type { DbClient } from "@/modules/galleries/gallery.repository";

export const selectionRepository = {
  setPhotoSelection(galleryId: string, photoId: string, selected: boolean, comment?: string, client: DbClient = db) {
    return client.selection.upsert({
      where: { photoId },
      create: { galleryId, photoId, selected, comment },
      update: { selected, comment },
    });
  },
  countSelected(galleryId: string, client: DbClient = db) {
    return client.selection.count({ where: { galleryId, selected: true } });
  },
  selectedForGallery(galleryId: string, client: DbClient = db) {
    return client.selection.findMany({
      where: { galleryId, selected: true },
      include: { photo: true },
      orderBy: { photo: { sortOrder: "asc" } },
    });
  },
};
