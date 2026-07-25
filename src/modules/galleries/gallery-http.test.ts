import { z } from "zod";
import { describe, expect, it } from "vitest";
import {
  GalleryNotFoundError,
  GalleryUnavailableError,
  InvalidGalleryTransitionError,
  SelectionClosedError,
  SelectionCountMismatchError,
} from "./gallery.errors";
import { galleryErrorMessage, galleryErrorStatus } from "./gallery-http";

describe("gallery HTTP error mapping", () => {
  it.each([
    [new GalleryNotFoundError(), 404],
    [new GalleryUnavailableError(), 410],
    [new InvalidGalleryTransitionError(), 409],
    [new SelectionClosedError(), 409],
    [new SelectionCountMismatchError(), 409],
  ])("maps %s to %i", (error, status) => {
    expect(galleryErrorStatus(error)).toBe(status);
    expect(galleryErrorMessage(error)).toBe(error.message);
  });

  it("maps invalid payloads to 400", () => {
    let error: unknown;
    try {
      z.object({ selected: z.boolean() }).parse({ selected: "yes" });
    } catch (caught) {
      error = caught;
    }

    expect(galleryErrorStatus(error)).toBe(400);
  });

  it("returns a safe message for unexpected errors", () => {
    const error = new Error("Prisma connection string and internal detail");

    expect(galleryErrorStatus(error)).toBe(500);
    expect(galleryErrorMessage(error)).toBe("Unexpected error");
  });
});
