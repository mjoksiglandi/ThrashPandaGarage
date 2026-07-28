import { GalleryStatus, type Gallery } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { gallerySchema } from "@/lib/validators";
import { createAccessToken, slugify } from "@/lib/tokens";
import { GalleryNotFoundError, InvalidGalleryTransitionError } from "./gallery.errors";
import { galleryRepository } from "./gallery.repository";
import { assertGalleryTransition, isSelectionOpen } from "./gallery-workflow";
import { selectionRepository } from "@/modules/selections/selection.repository";

export type AdminActor = { actorId: string };

const SELECTION_LIMIT_LOCKED_STATUSES = new Set<GalleryStatus>([
  GalleryStatus.SELECTION_CONFIRMED,
  GalleryStatus.EDITING,
  GalleryStatus.READY_FOR_DELIVERY,
  GalleryStatus.DELIVERED,
  GalleryStatus.ARCHIVED,
]);

const GALLERY_METADATA_FIELDS = [
  "clientId",
  "title",
  "slug",
  "selectionLimit",
  "expiresAt",
  "proofingLocalPath",
  "thumbnailLocalPath",
  "previewLocalPath",
  "googleDriveFolderUrl",
  "deliveryDriveUrl",
] as const;

export function isGalleryAccessible(
  gallery: { status: GalleryStatus; expiresAt: Date | null },
  now: Date
): boolean {
  return (
    gallery.status !== GalleryStatus.ARCHIVED &&
    (!gallery.expiresAt || gallery.expiresAt > now)
  );
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
  };
}

function assertAdminActor(actor: AdminActor): void {
  if (!actor.actorId.trim()) {
    throw new Error("Admin actorId is required");
  }
}

function persistedValuesEqual(left: unknown, right: unknown): boolean {
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() === right.getTime();
  }
  return left === right;
}

function changedMetadataFields(current: Gallery, updates: ReturnType<typeof cleanGalleryForm>): string[] {
  return GALLERY_METADATA_FIELDS.filter((field) => !persistedValuesEqual(current[field], updates[field]));
}

export async function createGalleryFromForm(formData: FormData, actor: AdminActor) {
  assertAdminActor(actor);
  const data = cleanGalleryForm(formData);
  const gallery = await db.$transaction(async (tx) => {
    const created = await galleryRepository.create(
      {
        ...data,
        status: GalleryStatus.DRAFT,
        accessToken: createAccessToken(),
      },
      tx
    );
    await galleryRepository.event(
      {
        galleryId: created.id,
        type: "GALLERY_CREATED",
        actorType: "ADMIN",
        actorId: actor.actorId,
        metadata: { status: created.status },
      },
      tx
    );
    return created;
  });
  revalidatePath("/admin/galleries");
  return gallery;
}

export async function updateGalleryFromForm(id: string, formData: FormData, actor: AdminActor) {
  assertAdminActor(actor);
  const data = cleanGalleryForm(formData);
  const result = await db.$transaction(async (tx) => {
    const current = await galleryRepository.findForUpdate(id, tx);
    if (!current) throw new GalleryNotFoundError();

    if (data.selectionLimit !== current.selectionLimit) {
      if (
        current.selectionConfirmedAt ||
        SELECTION_LIMIT_LOCKED_STATUSES.has(current.status)
      ) {
        throw new InvalidGalleryTransitionError("Selection limit cannot change after selection confirmation");
      }
      if (data.selectionLimit !== null) {
        const selectedCount = await selectionRepository.countSelected(id, tx);
        if (data.selectionLimit < selectedCount) {
          throw new InvalidGalleryTransitionError(
            "Selection limit cannot be lower than the current selected count"
          );
        }
      }
    }

    const changedFields = changedMetadataFields(current, data);
    if (changedFields.length === 0) {
      return { gallery: current, changed: false };
    }

    const gallery = await galleryRepository.update(id, data, tx);
    await galleryRepository.event(
      {
        galleryId: id,
        type: "GALLERY_UPDATED",
        actorType: "ADMIN",
        actorId: actor.actorId,
        metadata: { status: current.status, changedFields },
      },
      tx
    );
    return { gallery, changed: true };
  });

  if (result.changed) {
    revalidatePath(`/admin/galleries/${id}`);
  }
  return result.gallery;
}

export async function transitionGallery(id: string, next: GalleryStatus, actor: AdminActor): Promise<Gallery> {
  assertAdminActor(actor);
  return db.$transaction(async (tx) => {
    const current = await galleryRepository.findForUpdate(id, tx);
    if (!current) throw new GalleryNotFoundError();
    if (current.status === next) return current;

    assertGalleryTransition(current.status, next);
    assertReadyForDeliveryAllowed({
      status: next,
      deliveryDriveUrl: current.deliveryDriveUrl,
    });

    const gallery = await galleryRepository.update(id, { status: next }, tx);
    await galleryRepository.event(
      {
        galleryId: id,
        type: "GALLERY_TRANSITIONED",
        actorType: "ADMIN",
        actorId: actor.actorId,
        metadata: { fromStatus: current.status, toStatus: next },
      },
      tx
    );
    return gallery;
  });
}

export async function archiveGallery(id: string, actor: AdminActor) {
  const gallery = await transitionGallery(id, GalleryStatus.ARCHIVED, actor);
  revalidatePath("/admin/galleries");
  return gallery;
}

export { isSelectionOpen };
