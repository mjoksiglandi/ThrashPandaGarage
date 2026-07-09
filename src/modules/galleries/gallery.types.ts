import type { GalleryStatus } from "@prisma/client";

export type GalleryInput = {
  clientId: string;
  title: string;
  slug: string;
  selectionLimit?: number | null;
  expiresAt?: Date | null;
  proofingLocalPath?: string | null;
  thumbnailLocalPath?: string | null;
  previewLocalPath?: string | null;
  googleDriveFolderUrl?: string | null;
  deliveryDriveUrl?: string | null;
  status?: GalleryStatus;
};
