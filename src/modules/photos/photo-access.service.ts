import type { GalleryStatus } from "@prisma/client";
import { isGalleryAccessible } from "@/modules/galleries/gallery.service";

type AccessCheckGallery = {
  status: GalleryStatus;
  expiresAt: Date | null;
  accessToken: string;
};

export function canServePhoto(
  gallery: AccessCheckGallery,
  options: { isAdmin: boolean; token: string | null }
): boolean {
  if (options.isAdmin) return true;
  if (!options.token || options.token !== gallery.accessToken) return false;
  return isGalleryAccessible(gallery);
}
