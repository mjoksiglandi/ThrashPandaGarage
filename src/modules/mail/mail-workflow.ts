import { GalleryStatus } from "@prisma/client";

export class InvalidGalleryInvitationStatusError extends Error {
  constructor(operation: "send" | "resend", status: GalleryStatus) {
    super(`Cannot ${operation} gallery invitation while gallery is ${status}`);
    this.name = "InvalidGalleryInvitationStatusError";
  }
}

export function canSendInitialInvitation(status: GalleryStatus): boolean {
  return status === GalleryStatus.DRAFT;
}

export function canResendInvitation(status: GalleryStatus): boolean {
  return status === GalleryStatus.EMAIL_SENT || status === GalleryStatus.PROOFING;
}

export function assertCanSendInitialInvitation(status: GalleryStatus): void {
  if (!canSendInitialInvitation(status)) {
    throw new InvalidGalleryInvitationStatusError("send", status);
  }
}

export function assertCanResendInvitation(status: GalleryStatus): void {
  if (!canResendInvitation(status)) {
    throw new InvalidGalleryInvitationStatusError("resend", status);
  }
}
