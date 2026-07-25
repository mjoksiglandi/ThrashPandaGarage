import { GalleryStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  assertCanResendInvitation,
  assertCanSendInitialInvitation,
  canResendInvitation,
  canSendInitialInvitation,
  InvalidGalleryInvitationStatusError,
} from "./mail-workflow";

describe("gallery invitation policy", () => {
  it("allows the initial invitation only from DRAFT", () => {
    for (const status of Object.values(GalleryStatus)) {
      expect(canSendInitialInvitation(status)).toBe(status === GalleryStatus.DRAFT);
    }
  });

  it("allows resends only from EMAIL_SENT and PROOFING", () => {
    for (const status of Object.values(GalleryStatus)) {
      expect(canResendInvitation(status)).toBe(
        status === GalleryStatus.EMAIL_SENT || status === GalleryStatus.PROOFING
      );
    }
  });

  it("rejects both operations from ARCHIVED", () => {
    expect(() => assertCanSendInitialInvitation(GalleryStatus.ARCHIVED)).toThrow(
      InvalidGalleryInvitationStatusError
    );
    expect(() => assertCanResendInvitation(GalleryStatus.ARCHIVED)).toThrow(
      InvalidGalleryInvitationStatusError
    );
  });

  it.each([
    GalleryStatus.SELECTION_CONFIRMED,
    GalleryStatus.EDITING,
    GalleryStatus.READY_FOR_DELIVERY,
    GalleryStatus.DELIVERED,
  ])("rejects selection email operations after PROOFING from %s", (status) => {
    expect(() => assertCanSendInitialInvitation(status)).toThrow(
      InvalidGalleryInvitationStatusError
    );
    expect(() => assertCanResendInvitation(status)).toThrow(
      InvalidGalleryInvitationStatusError
    );
  });
});
