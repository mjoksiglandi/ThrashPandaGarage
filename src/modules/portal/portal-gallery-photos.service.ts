export type PortalGalleryPhoto = {
  id: string;
  baseName: string;
  selected: boolean;
};

type PortalGalleryPhotoRecord = {
  id: string;
  baseName: string;
  selection: { selected: boolean } | null;
};

type PortalGalleryPhotosDependencies = {
  photos: {
    listAvailableForGallery(galleryId: string): Promise<PortalGalleryPhotoRecord[]>;
  };
};

export function createPortalGalleryPhotosService(
  dependencies: PortalGalleryPhotosDependencies
) {
  return {
    async listForGallery(galleryId: string): Promise<PortalGalleryPhoto[]> {
      const photos = await dependencies.photos.listAvailableForGallery(galleryId);
      return photos.map((photo) => ({
        id: photo.id,
        baseName: photo.baseName,
        selected: photo.selection?.selected ?? false,
      }));
    },
  };
}
