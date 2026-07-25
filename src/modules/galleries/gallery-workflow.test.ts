import { GalleryStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  allowedGalleryTransitions,
  canTransitionGallery,
  GALLERY_TRANSITIONS,
  isSelectionOpen,
} from "./gallery-workflow";

const statuses = Object.values(GalleryStatus);

describe("gallery workflow transitions", () => {
  it("allows every listed transition", () => {
    for (const [from, allowed] of Object.entries(GALLERY_TRANSITIONS) as [
      GalleryStatus,
      readonly GalleryStatus[],
    ][]) {
      for (const to of allowed) {
        expect(canTransitionGallery(from, to), `${from} -> ${to}`).toBe(true);
      }
    }
  });

  it("rejects every unlisted transition", () => {
    for (const from of statuses) {
      for (const to of statuses) {
        if (from === to || allowedGalleryTransitions(from).includes(to)) continue;
        expect(canTransitionGallery(from, to), `${from} -> ${to}`).toBe(false);
      }
    }
  });

  it("does not allow transitions out of ARCHIVED", () => {
    expect(allowedGalleryTransitions(GalleryStatus.ARCHIVED)).toEqual([]);
  });
});

describe("isSelectionOpen", () => {
  const now = new Date("2026-07-23T12:00:00.000Z");

  it("opens selection only for non-expired PROOFING galleries", () => {
    expect(isSelectionOpen({ status: GalleryStatus.PROOFING, expiresAt: null }, now)).toBe(true);
    expect(isSelectionOpen({ status: GalleryStatus.PROOFING, expiresAt: new Date("2026-07-23T12:00:01.000Z") }, now)).toBe(true);
  });

  it("closes selection for all non-PROOFING statuses", () => {
    for (const status of statuses.filter((status) => status !== GalleryStatus.PROOFING)) {
      expect(isSelectionOpen({ status, expiresAt: null }, now), status).toBe(false);
    }
  });

  it("treats expiry equal to or before now as closed", () => {
    expect(isSelectionOpen({ status: GalleryStatus.PROOFING, expiresAt: now }, now)).toBe(false);
    expect(isSelectionOpen({ status: GalleryStatus.PROOFING, expiresAt: new Date("2026-07-23T11:59:59.000Z") }, now)).toBe(false);
  });
});
