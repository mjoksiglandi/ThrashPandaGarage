import type { Gallery } from "@prisma/client";
import { GalleryStatus } from "@prisma/client";
import { InvalidGalleryTransitionError } from "./gallery.errors";

export const GALLERY_TRANSITIONS = {
  DRAFT: ["EMAIL_SENT", "PROOFING", "ARCHIVED"],
  EMAIL_SENT: ["PROOFING", "ARCHIVED"],
  PROOFING: ["SELECTION_CONFIRMED", "ARCHIVED"],
  SELECTION_CONFIRMED: ["EDITING", "ARCHIVED"],
  EDITING: ["READY_FOR_DELIVERY", "ARCHIVED"],
  READY_FOR_DELIVERY: ["DELIVERED", "EDITING", "ARCHIVED"],
  DELIVERED: ["ARCHIVED"],
  ARCHIVED: [],
} as const satisfies Record<GalleryStatus, readonly GalleryStatus[]>;

export function allowedGalleryTransitions(current: GalleryStatus): readonly GalleryStatus[] {
  return GALLERY_TRANSITIONS[current];
}

export function canTransitionGallery(current: GalleryStatus, next: GalleryStatus): boolean {
  return current === next || allowedGalleryTransitions(current).includes(next);
}

export function assertGalleryTransition(current: GalleryStatus, next: GalleryStatus): void {
  if (!canTransitionGallery(current, next)) {
    throw new InvalidGalleryTransitionError(`Cannot transition gallery from ${current} to ${next}`);
  }
}

export function isSelectionOpen(gallery: Pick<Gallery, "status" | "expiresAt">, now = new Date()): boolean {
  return gallery.status === GalleryStatus.PROOFING && (!gallery.expiresAt || gallery.expiresAt > now);
}

export function hasConfirmedSelection(gallery: Pick<Gallery, "selectionConfirmedAt">): boolean {
  return gallery.selectionConfirmedAt !== null;
}
