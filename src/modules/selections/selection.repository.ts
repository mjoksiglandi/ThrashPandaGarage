import { db } from "@/lib/db";

export const selectionRepository = {
  setPhotoSelection(galleryId: string, photoId: string, selected: boolean, comment?: string) {
    return db.selection.upsert({
      where: { photoId },
      create: { galleryId, photoId, selected, comment },
      update: { selected, comment },
    });
  },
  selectedForGallery(galleryId: string) {
    return db.selection.findMany({
      where: { galleryId, selected: true },
      include: { photo: true },
      orderBy: { photo: { sortOrder: "asc" } },
    });
  },
};
