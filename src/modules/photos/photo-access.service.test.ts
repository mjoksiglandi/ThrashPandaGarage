import { GalleryStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canServePhoto } from "./photo-access.service";

const activeGallery = { status: GalleryStatus.PROOFING, expiresAt: null, accessToken: "tpg_abc123" };
const archivedGallery = { status: GalleryStatus.ARCHIVED, expiresAt: null, accessToken: "tpg_abc123" };
const expiredGallery = {
  status: GalleryStatus.PROOFING,
  expiresAt: new Date(Date.now() - 1000),
  accessToken: "tpg_abc123",
};

describe("canServePhoto", () => {
  it("allows admins regardless of gallery state", () => {
    expect(canServePhoto(archivedGallery, { isAdmin: true, token: null })).toBe(true);
  });

  it("allows a matching token on an active gallery", () => {
    expect(canServePhoto(activeGallery, { isAdmin: false, token: "tpg_abc123" })).toBe(true);
  });

  it("rejects a missing token for non-admins", () => {
    expect(canServePhoto(activeGallery, { isAdmin: false, token: null })).toBe(false);
  });

  it("rejects a mismatched token", () => {
    expect(canServePhoto(activeGallery, { isAdmin: false, token: "tpg_wrong" })).toBe(false);
  });

  it("rejects a matching token on an archived gallery", () => {
    expect(canServePhoto(archivedGallery, { isAdmin: false, token: "tpg_abc123" })).toBe(false);
  });

  it("rejects a matching token on an expired gallery", () => {
    expect(canServePhoto(expiredGallery, { isAdmin: false, token: "tpg_abc123" })).toBe(false);
  });
});
