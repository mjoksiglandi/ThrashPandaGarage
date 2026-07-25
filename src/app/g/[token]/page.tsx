import { GalleryStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { ClientGallery } from "@/components/gallery/ClientGallery";
import { galleryRepository } from "@/modules/galleries/gallery.repository";
import { isGalleryAccessible } from "@/modules/galleries/gallery.service";
import { isSelectionOpen } from "@/modules/galleries/gallery-workflow";

export const dynamic = "force-dynamic";

export default async function PrivateGalleryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const gallery = await galleryRepository.findByToken(token);
  if (!gallery || !isGalleryAccessible(gallery)) notFound();

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
      selectionOpen={isSelectionOpen(gallery)}
      alreadyConfirmed={gallery.selectionConfirmedAt !== null}
      photos={gallery.photos.map((photo) => ({
        id: photo.id,
        filename: photo.filename,
        baseName: photo.baseName,
        selected: photo.selection?.selected ?? false,
        comment: photo.selection?.comment ?? "",
        thumbUrl: `/api/photos/${photo.id}?variant=thumb&token=${token}`,
        previewUrl: `/api/photos/${photo.id}?variant=preview&token=${token}`,
      }))}
    />
  );
}
