"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { importGalleryPhotos } from "@/modules/photos/photo-import.service";

export async function importGalleryPhotosAction(galleryId: string) {
  const admin = await requireAdmin();
  let target = `/admin/galleries/${galleryId}`;
  try {
    const result = await importGalleryPhotos(galleryId, { actorType: "ADMIN", actorId: admin.id });
    const query = new URLSearchParams({
      success: "imported",
      imported: String(result.importedCount),
      updated: String(result.updatedCount),
      skipped: String(result.skippedCount),
    });
    target += `?${query}`;
  } catch {
    target += "?error=No%20se%20pudieron%20importar%20las%20fotos.%20Revisa%20las%20rutas%20configuradas%20e%20int%C3%A9ntalo%20nuevamente.";
  }
  redirect(target);
}
