import { GalleryStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { ClientGallery } from "@/components/gallery/ClientGallery";
import { galleryRepository } from "@/modules/galleries/gallery.repository";

export const dynamic = "force-dynamic";

export default async function PrivateGalleryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const gallery = await galleryRepository.findByToken(token);
  if (!gallery || gallery.status === GalleryStatus.ARCHIVED) notFound();
  if (gallery.expiresAt && gallery.expiresAt < new Date()) notFound();

  const canShowDelivery =
    (gallery.status === GalleryStatus.READY_FOR_DELIVERY || gallery.status === GalleryStatus.DELIVERED) &&
    Boolean(gallery.deliveryDriveUrl);

  return (
    <ClientGallery
      token={token}
      title={gallery.title}
      clientName={gallery.client.name}
      selectionLimit={gallery.selectionLimit}
      deliveryDriveUrl={gallery.deliveryDriveUrl}
      canShowDelivery={canShowDelivery}
      alreadyConfirmed={gallery.status === GalleryStatus.SELECTION_CONFIRMED}
      photos={gallery.photos.map((photo) => ({
        id: photo.id,
        filename: photo.filename,
        baseName: photo.baseName,
        selected: photo.selection?.selected ?? false,
        comment: photo.selection?.comment ?? "",
        thumbUrl: `/api/photos/${photo.id}?variant=thumb`,
        previewUrl: `/api/photos/${photo.id}?variant=preview`,
      }))}
    />
  );
}
