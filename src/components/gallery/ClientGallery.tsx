"use client";

import { useMemo, useState, useTransition } from "react";
import { ConfirmSelectionButton } from "./ConfirmSelectionButton";
import { DeliveryDriveButton } from "./DeliveryDriveButton";
import { GalleryGrid } from "./GalleryGrid";
import { PhotoLightbox } from "./PhotoLightbox";
import { SelectionCounter } from "./SelectionCounter";
import type { Photo } from "./gallery.types";

export function ClientGallery({
  token,
  title,
  clientName,
  selectionLimit,
  photos,
  deliveryDriveUrl,
  canShowDelivery,
  alreadyConfirmed,
}: {
  token: string;
  title: string;
  clientName?: string;
  selectionLimit?: number | null;
  photos: Photo[];
  deliveryDriveUrl?: string | null;
  canShowDelivery: boolean;
  alreadyConfirmed: boolean;
}) {
  const [items, setItems] = useState(photos);
  const [active, setActive] = useState<Photo | null>(null);
  const [confirmed, setConfirmed] = useState(alreadyConfirmed);
  const [pending, startTransition] = useTransition();
  const selectedCount = useMemo(() => items.filter((item) => item.selected).length, [items]);

  function updatePhoto(photo: Photo, selected: boolean, comment = photo.comment) {
    if (selected && !photo.selected && selectionLimit && selectedCount >= selectionLimit) return;
    setItems((current) => current.map((item) => (item.id === photo.id ? { ...item, selected, comment } : item)));
    startTransition(async () => {
      const response = await fetch(`/api/galleries/${token}/selection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: photo.id, selected, comment }),
      });
      if (!response.ok) setItems(photos);
    });
  }

  function confirm() {
    startTransition(async () => {
      const response = await fetch(`/api/galleries/${token}/confirm`, { method: "POST" });
      if (response.ok) setConfirmed(true);
    });
  }

  return (
    <main className="min-h-screen px-5 py-8">
      <section className="mx-auto max-w-6xl">
        <p className="text-sm uppercase tracking-[0.35em] text-[#d9902f]">Trashpanda Garage</p>
        <h1 className="mt-3 text-4xl font-black">{title}</h1>
        {clientName && <p className="mt-2 text-zinc-400">{clientName}</p>}
        <p className="mt-6 max-w-2xl text-zinc-300">
          Selecciona tus fotos favoritas. Cuando termines, confirma tu selección para avanzar con la edición final.
        </p>
        <div className="sticky top-0 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-zinc-800 bg-[#09090b]/95 py-4">
          <SelectionCounter selectedCount={selectedCount} selectionLimit={selectionLimit} />
          <div className="flex gap-3">
            {canShowDelivery && deliveryDriveUrl && <DeliveryDriveButton url={deliveryDriveUrl} />}
            <ConfirmSelectionButton confirmed={confirmed} pending={pending} onConfirm={confirm} />
          </div>
        </div>
        {confirmed && (
          <p className="mt-4 rounded-lg border border-zinc-800 bg-[#141417] p-4 text-zinc-200">
            Tu selección fue enviada. Gracias, pronto prepararé la entrega final.
          </p>
        )}
        <GalleryGrid
          photos={items}
          onOpen={setActive}
          onToggleSelected={(photo) => updatePhoto(photo, !photo.selected)}
          onCommentChange={(photo, comment) => updatePhoto(photo, photo.selected, comment)}
        />
      </section>
      {active && <PhotoLightbox photo={active} onClose={() => setActive(null)} />}
    </main>
  );
}
