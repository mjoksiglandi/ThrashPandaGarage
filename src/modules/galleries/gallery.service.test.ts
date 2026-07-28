import { GalleryStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { isGalleryAccessible, assertReadyForDeliveryAllowed } from "./gallery.service";

describe("isGalleryAccessible", () => {
  const now = new Date("2030-01-02T03:04:05.000Z");

  it("rejects archived galleries", () => {
    expect(isGalleryAccessible({ status: GalleryStatus.ARCHIVED, expiresAt: null }, now)).toBe(false);
  });

  it("rejects expired galleries", () => {
    const expired = new Date(now.getTime() - 1);
    expect(isGalleryAccessible({ status: GalleryStatus.PROOFING, expiresAt: expired }, now)).toBe(false);
  });

  it("treats expiresAt equal to now as expired", () => {
    expect(isGalleryAccessible({ status: GalleryStatus.PROOFING, expiresAt: now }, now)).toBe(false);
  });

  it("allows active galleries with no expiry", () => {
    expect(isGalleryAccessible({ status: GalleryStatus.PROOFING, expiresAt: null }, now)).toBe(true);
  });

  it("allows active galleries with a future expiry", () => {
    const future = new Date(now.getTime() + 1);
    expect(isGalleryAccessible({ status: GalleryStatus.PROOFING, expiresAt: future }, now)).toBe(true);
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
