import { GalleryStatus } from "@prisma/client";
import { z } from "zod";

export const clientSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const gallerySchema = z.object({
  clientId: z.string().min(1),
  title: z.string().trim().min(1),
  slug: z.string().trim().optional(),
  selectionLimit: z.coerce.number().int().positive().optional().or(z.literal("")),
  expiresAt: z.string().optional(),
  proofingLocalPath: z.string().trim().optional(),
  thumbnailLocalPath: z.string().trim().optional(),
  previewLocalPath: z.string().trim().optional(),
  googleDriveFolderUrl: z.string().trim().url().optional().or(z.literal("")),
  deliveryDriveUrl: z.string().trim().url().optional().or(z.literal("")),
  status: z.nativeEnum(GalleryStatus).optional(),
});

export const selectionSchema = z.object({
  photoId: z.string().min(1),
  selected: z.boolean(),
  comment: z.string().max(1000).optional(),
});

export const supportedImageExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
