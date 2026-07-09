"use client";

import { useMemo, useState, useTransition } from "react";

type Photo = {
  id: string;
  filename: string;
  baseName: string;
  selected: boolean;
  comment: string;
  thumbUrl: string;
  previewUrl: string;
};

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
          Selecciona tus fotos favoritas. Cuando termines, confirma tu seleccion para avanzar con la edicion final.
        </p>
        <div className="sticky top-0 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-zinc-800 bg-[#09090b]/95 py-4">
          <strong>{selectedCount}{selectionLimit ? ` / ${selectionLimit}` : ""} seleccionadas</strong>
          <div className="flex gap-3">
            {canShowDelivery && deliveryDriveUrl && <a className="button" href={deliveryDriveUrl} target="_blank">Abrir entrega Drive</a>}
            <button type="button" disabled={pending || confirmed} onClick={confirm}>
              {confirmed ? "Seleccion enviada" : "Confirmar seleccion"}
            </button>
          </div>
        </div>
        {confirmed && <p className="mt-4 rounded-lg border border-zinc-800 bg-[#141417] p-4 text-zinc-200">Tu seleccion fue enviada. Gracias, pronto preparare la entrega final.</p>}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((photo) => (
            <article key={photo.id} className={`rounded-lg border bg-[#141417] p-2 ${photo.selected ? "border-[#d9902f]" : "border-zinc-800"}`}>
              <button type="button" onClick={() => setActive(photo)} className="block w-full overflow-hidden rounded-md border-0 bg-transparent p-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.thumbUrl} alt={photo.baseName} className="aspect-square w-full object-cover" />
              </button>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="truncate text-sm text-zinc-300">{photo.baseName}</span>
                <button type="button" className={photo.selected ? "" : "secondary"} onClick={() => updatePhoto(photo, !photo.selected)}>
                  {photo.selected ? "OK" : "Elegir"}
                </button>
              </div>
              <textarea
                className="mt-2 text-sm"
                rows={2}
                placeholder="Comentario"
                value={photo.comment}
                onChange={(event) => updatePhoto(photo, photo.selected, event.target.value)}
              />
            </article>
          ))}
        </div>
      </section>
      {active && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-black/90 p-4" onClick={() => setActive(null)}>
          <div className="max-h-full max-w-5xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={active.previewUrl} alt={active.baseName} className="max-h-[85vh] rounded-lg object-contain" />
          </div>
        </div>
      )}
    </main>
  );
}
