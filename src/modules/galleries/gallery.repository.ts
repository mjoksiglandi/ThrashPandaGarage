import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { GalleryInput } from "./gallery.types";

export const galleryRepository = {
  list() {
    return db.gallery.findMany({
      orderBy: { createdAt: "desc" },
      include: { client: true, photos: { select: { id: true } }, selections: true },
    });
  },
  find(id: string) {
    return db.gallery.findUnique({
      where: { id },
      include: {
        client: true,
        photos: { orderBy: { sortOrder: "asc" }, include: { selection: true } },
        selections: { include: { photo: true } },
        events: { orderBy: { createdAt: "desc" } },
      },
    });
  },
  findByToken(accessToken: string) {
    return db.gallery.findUnique({
      where: { accessToken },
      include: {
        client: true,
        photos: { orderBy: { sortOrder: "asc" }, include: { selection: true } },
      },
    });
  },
  create(data: GalleryInput & { accessToken: string }) {
    return db.gallery.create({ data });
  },
  update(id: string, data: Prisma.GalleryUncheckedUpdateInput) {
    return db.gallery.update({ where: { id }, data });
  },
  event(galleryId: string, type: string, metadata?: Prisma.InputJsonValue) {
    return db.galleryEvent.create({ data: { galleryId, type, metadata } });
  },
};
