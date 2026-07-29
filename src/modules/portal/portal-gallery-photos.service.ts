export type PortalGalleryPhoto = {
  id: string;
  baseName: string;
};

type PortalGalleryPhotosDependencies = {
  photos: {
    listAvailableForGallery(galleryId: string): Promise<PortalGalleryPhoto[]>;
  };
};

export function createPortalGalleryPhotosService(
  dependencies: PortalGalleryPhotosDependencies
) {
  return {
    listForGallery(galleryId: string) {
      return dependencies.photos.listAvailableForGallery(galleryId);
    },
  };
}
