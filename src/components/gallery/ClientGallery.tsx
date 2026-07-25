"use client";

import { useMemo, useState, useTransition } from "react";
import { GalleryGrid } from "./GalleryGrid";
import { PhotoLightbox } from "./PhotoLightbox";
import type { Photo } from "./gallery.types";

export function ClientGallery({
  token,
  title,
  clientName,
  selectionLimit,
  photos,
  deliveryDriveUrl,
  canShowDelivery,
  selectionOpen,
  alreadyConfirmed,
}: {
  token: string;
  title: string;
  clientName?: string;
  selectionLimit?: number | null;
  photos: Photo[];
  deliveryDriveUrl?: string | null;
  canShowDelivery: boolean;
  selectionOpen: boolean;
  alreadyConfirmed: boolean;
}) {
  const [items, setItems] = useState(photos);
  const [active, setActive] = useState<Photo | null>(null);
  const [confirmed, setConfirmed] = useState(alreadyConfirmed);
  const [pending, startTransition] = useTransition();
  const selectedCount = useMemo(() => items.filter((item) => item.selected).length, [items]);
  const commentedCount = useMemo(() => items.filter((item) => item.comment.trim().length > 0).length, [items]);
  const limitReached = Boolean(selectionLimit && selectedCount >= selectionLimit);
  const canConfirm =
    selectionOpen &&
    selectedCount > 0 &&
    (selectionLimit == null || selectedCount === selectionLimit);

  function updatePhoto(photo: Photo, selected: boolean, comment = photo.comment) {
    if (!selectionOpen || confirmed) return;
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
    if (!canConfirm || confirmed) return;
    startTransition(async () => {
      const response = await fetch(`/api/galleries/${token}/confirm`, { method: "POST" });
      if (response.ok) setConfirmed(true);
    });
  }

  return (
    <main className="min-h-screen bg-[var(--background)] pb-28">
      <header className="flex items-center justify-between border-b border-[var(--line)] px-5 py-5 md:px-10">
        <div className="flex items-center gap-3">
          <span className="brand-mark h-[18px] w-[18px]" />
          <span className="text-sm font-semibold">TRASHPANDA GARAGE</span>
        </div>
        <span className="mono rounded-[3px] border border-[var(--line-strong)] bg-white/[0.02] px-2.5 py-1.5 text-[11px] uppercase tracking-[0.06em] text-[#d8d6dd]">
          {confirmed ? "Seleccion confirmada" : "En revision"}
        </span>
      </header>

      <section className="section-line px-5 py-10 md:px-10">
        <p className="mono mb-3 text-xs uppercase tracking-[0.08em] text-[var(--muted-2)]">Galeria privada</p>
        <h1 className="text-3xl font-semibold">{title}</h1>
        {clientName && <p className="mt-2 text-sm text-[var(--muted)]">Para {clientName}</p>}
        <p className="mt-5 max-w-xl text-[14.5px] leading-7 text-[#d8d6dd]">
          Selecciona tus fotos favoritas. Puedes dejar un comentario en cualquiera. Cuando termines, confirma tu
          seleccion para avanzar con la edicion final.
        </p>
      </section>

      <section className="px-5 py-8 md:px-10">
        {confirmed && (
          <div className="mx-auto mb-8 max-w-xl text-center">
            <span className="brand-mark mb-7 inline-block" />
            <h2 className="text-3xl font-semibold">Tu seleccion fue enviada.</h2>
            <p className="mt-3 text-[var(--muted)]">Gracias, pronto preparare la entrega final.</p>
            <div className="mt-7 flex justify-center gap-8 border-y border-[var(--line)] py-5">
              <Stat label="fotos seleccionadas" value={selectedCount} />
              <Stat label="comentarios enviados" value={commentedCount} />
            </div>
          </div>
        )}
        {canShowDelivery && deliveryDriveUrl && (
          <div className="mx-auto mb-8 max-w-xl text-center">
            <h2 className="text-3xl font-semibold">Entrega lista.</h2>
            <p className="mt-3 text-[var(--muted)]">Puedes descargar tus fotos desde Google Drive.</p>
            <div className="mt-6">
              <a className="button" href={deliveryDriveUrl} target="_blank" rel="noreferrer">
                Ver entrega en Google Drive
              </a>
            </div>
          </div>
        )}
        {!selectionOpen && !confirmed && (
          <div className="mb-6 rounded-[4px] border border-[var(--line)] bg-[var(--panel-2)] p-5 text-sm text-[var(--muted)]">
            Esta galeria no acepta cambios de seleccion en su estado actual.
          </div>
        )}
        {limitReached && !confirmed && (
          <div className="mb-6 flex max-w-2xl flex-wrap items-center justify-between gap-4 rounded-[4px] border border-[oklch(72%_0.12_65_/_0.4)] bg-[var(--panel-2)] p-5">
            <div>
              <p className="text-sm text-[var(--foreground)]">Alcanzaste el limite de seleccion</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {selectedCount} / {selectionLimit} fotos seleccionadas. Deselecciona una para elegir otra, o confirma
                tu seleccion.
              </p>
            </div>
            <button type="button" disabled={pending || confirmed || !canConfirm} onClick={confirm}>
              {confirmed ? "Seleccion enviada" : "Confirmar seleccion"}
            </button>
          </div>
        )}
        <GalleryGrid
          photos={items}
          onOpen={setActive}
          onToggleSelected={(photo) => updatePhoto(photo, !photo.selected)}
          onCommentChange={(photo, comment) => updatePhoto(photo, photo.selected, comment)}
          selectionOpen={selectionOpen && !confirmed}
        />
      </section>
      {active && <PhotoLightbox photo={active} onClose={() => setActive(null)} />}
      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-4 border-t border-white/10 bg-[rgba(12,12,13,0.92)] px-5 py-4 backdrop-blur-md md:px-10">
        <strong className="mono text-sm font-medium text-[var(--foreground)]">
          {selectedCount}
          {selectionLimit ? ` / ${selectionLimit}` : ""}{" "}
          <span className="text-[var(--muted-2)]">seleccionadas</span>
        </strong>
        <button type="button" disabled={pending || confirmed || !canConfirm} onClick={confirm}>
          {confirmed ? "Seleccion enviada" : "Confirmar seleccion"}
        </button>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-[var(--muted-2)]">{label}</div>
    </div>
  );
}
