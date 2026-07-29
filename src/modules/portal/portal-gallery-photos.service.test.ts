import { describe, expect, it, vi } from "vitest";
import { createPortalGalleryPhotosService } from "./portal-gallery-photos.service";

describe("portal gallery photos service", () => {
  it("lists photos scoped to the given gallery id only", async () => {
    const listAvailableForGallery = vi.fn(async () => [
      { id: "photo-1", baseName: "photo-1" },
      { id: "photo-2", baseName: "photo-2" },
    ]);
    const service = createPortalGalleryPhotosService({
      photos: { listAvailableForGallery },
    });

    await expect(service.listForGallery("gallery-1")).resolves.toEqual([
      { id: "photo-1", baseName: "photo-1" },
      { id: "photo-2", baseName: "photo-2" },
    ]);
    expect(listAvailableForGallery).toHaveBeenCalledWith("gallery-1");
    expect(listAvailableForGallery).toHaveBeenCalledTimes(1);
  });
});
