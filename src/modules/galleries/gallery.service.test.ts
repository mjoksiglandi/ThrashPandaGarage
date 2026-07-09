import { GalleryStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { isGalleryAccessible } from "./gallery.service";

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
