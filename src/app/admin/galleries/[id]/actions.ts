"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { importGalleryPhotos } from "@/modules/photos/photo-import.service";

export async function importGalleryPhotosAction(galleryId: string) {
  const admin = await requireAdmin();
  await importGalleryPhotos(galleryId, { actorType: "ADMIN", actorId: admin.id });
  redirect(`/admin/galleries/${galleryId}`);
}
