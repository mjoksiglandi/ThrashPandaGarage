import type { Selection } from "@prisma/client";
import type { AccountSessionPrincipal } from "@/modules/account-sessions/current-account-session.service";
import { accountGalleryEventActor } from "@/modules/galleries/gallery-event-actor";
import {
  confirmSelectionForGallery,
  type ConfirmSelectionResult,
  updateSelectionForGallery,
} from "@/modules/selections/selection.service";

export async function setPortalPhotoSelection(
  galleryId: string,
  photoId: string,
  selected: boolean,
  comment?: string
): Promise<Selection> {
  return updateSelectionForGallery(galleryId, { photoId, selected, comment });
}

export function confirmPortalSelection(
  galleryId: string,
  principal: AccountSessionPrincipal
): Promise<ConfirmSelectionResult> {
  return confirmSelectionForGallery(galleryId, accountGalleryEventActor(principal));
}
