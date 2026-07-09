import { GalleryStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { isGalleryAccessible, assertReadyForDeliveryAllowed } from "./gallery.service";

describe("isGalleryAccessible", () => {
  it("rejects archived galleries", () => {
    expect(isGalleryAccessible({ status: GalleryStatus.ARCHIVED, expiresAt: null })).toBe(false);
  });

  it("rejects expired galleries", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(isGalleryAccessible({ status: GalleryStatus.PROOFING, expiresAt: yesterday })).toBe(false);
  });

  it("allows active galleries with no expiry", () => {
    expect(isGalleryAccessible({ status: GalleryStatus.PROOFING, expiresAt: null })).toBe(true);
  });

  it("allows active galleries with a future expiry", () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(isGalleryAccessible({ status: GalleryStatus.PROOFING, expiresAt: tomorrow })).toBe(true);
  });
});

describe("assertReadyForDeliveryAllowed", () => {
  it("throws when moving to READY_FOR_DELIVERY without a delivery URL", () => {
    expect(() =>
      assertReadyForDeliveryAllowed({ status: GalleryStatus.READY_FOR_DELIVERY, deliveryDriveUrl: null })
    ).toThrow();
  });

  it("allows moving to READY_FOR_DELIVERY with a delivery URL set", () => {
    expect(() =>
      assertReadyForDeliveryAllowed({
        status: GalleryStatus.READY_FOR_DELIVERY,
        deliveryDriveUrl: "https://drive.google.com/x",
      })
    ).not.toThrow();
  });

  it("allows any other status regardless of delivery URL", () => {
    expect(() => assertReadyForDeliveryAllowed({ status: GalleryStatus.PROOFING, deliveryDriveUrl: null })).not.toThrow();
  });
});
