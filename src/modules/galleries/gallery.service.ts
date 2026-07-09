import { GalleryStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { gallerySchema } from "@/lib/validators";
import { createAccessToken, slugify } from "@/lib/tokens";
import { galleryRepository } from "./gallery.repository";

export function isGalleryAccessible(gallery: { status: GalleryStatus; expiresAt: Date | null }): boolean {
  if (gallery.status === GalleryStatus.ARCHIVED) return false;
  if (gallery.expiresAt && gallery.expiresAt < new Date()) return false;
  return true;
}

export function assertReadyForDeliveryAllowed(data: {
  status?: GalleryStatus;
  deliveryDriveUrl?: string | null;
}): void {
  if (data.status === GalleryStatus.READY_FOR_DELIVERY && !data.deliveryDriveUrl) {
    throw new Error("Agrega el link de entrega de Google Drive antes de marcar como lista para entrega.");
  }
}

function cleanGalleryForm(formData: FormData) {
  const parsed = gallerySchema.parse(Object.fromEntries(formData));
  return {
    clientId: parsed.clientId,
    title: parsed.title,
    slug: parsed.slug ? slugify(parsed.slug) : slugify(parsed.title),
    selectionLimit: parsed.selectionLimit === "" ? null : parsed.selectionLimit ?? null,
    expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
    proofingLocalPath: parsed.proofingLocalPath || null,
    thumbnailLocalPath: parsed.thumbnailLocalPath || null,
    previewLocalPath: parsed.previewLocalPath || null,
    googleDriveFolderUrl: parsed.googleDriveFolderUrl || null,
    deliveryDriveUrl: parsed.deliveryDriveUrl || null,
    status: parsed.status,
  };
}

export async function createGalleryFromForm(formData: FormData) {
  const data = cleanGalleryForm(formData);
  const gallery = await galleryRepository.create({
    ...data,
    status: data.status ?? GalleryStatus.DRAFT,
    accessToken: createAccessToken(),
  });
  revalidatePath("/admin/galleries");
  return gallery;
}

export async function updateGalleryFromForm(id: string, formData: FormData) {
  const data = cleanGalleryForm(formData);
  assertReadyForDeliveryAllowed(data);
  const gallery = await galleryRepository.update(id, data);
  await galleryRepository.event(id, "GALLERY_UPDATED", { status: data.status });
  revalidatePath(`/admin/galleries/${id}`);
  return gallery;
}

export async function archiveGallery(id: string) {
  await galleryRepository.update(id, { status: GalleryStatus.ARCHIVED });
  await galleryRepository.event(id, "GALLERY_ARCHIVED");
  revalidatePath("/admin/galleries");
}

export async function markSelectionConfirmed(galleryId: string) {
  await galleryRepository.update(galleryId, {
    status: GalleryStatus.SELECTION_CONFIRMED,
    selectionConfirmedAt: new Date(),
  });
  await galleryRepository.event(galleryId, "SELECTION_CONFIRMED");
}
