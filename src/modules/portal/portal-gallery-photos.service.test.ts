import { describe, expect, it, vi } from "vitest";
import { createPortalGalleryPhotosService } from "./portal-gallery-photos.service";

describe("portal gallery photos service", () => {
  it("lists photos scoped to the given gallery id only, defaulting to unselected", async () => {
    const listAvailableForGallery = vi.fn(async () => [
      { id: "photo-1", baseName: "photo-1", selection: null },
      { id: "photo-2", baseName: "photo-2", selection: null },
    ]);
    const service = createPortalGalleryPhotosService({
      photos: { listAvailableForGallery },
    });

    await expect(service.listForGallery("gallery-1")).resolves.toEqual([
      { id: "photo-1", baseName: "photo-1", selected: false, comment: "" },
      { id: "photo-2", baseName: "photo-2", selected: false, comment: "" },
    ]);
    expect(listAvailableForGallery).toHaveBeenCalledWith("gallery-1");
    expect(listAvailableForGallery).toHaveBeenCalledTimes(1);
  });

  it("projects the persisted selection state for each photo", async () => {
    const listAvailableForGallery = vi.fn(async () => [
      { id: "photo-1", baseName: "photo-1", selection: { selected: true, comment: "Retocar" } },
      { id: "photo-2", baseName: "photo-2", selection: { selected: false, comment: null } },
    ]);
    const service = createPortalGalleryPhotosService({
      photos: { listAvailableForGallery },
    });

    await expect(service.listForGallery("gallery-1")).resolves.toEqual([
      { id: "photo-1", baseName: "photo-1", selected: true, comment: "Retocar" },
      { id: "photo-2", baseName: "photo-2", selected: false, comment: "" },
    ]);
  });
});
