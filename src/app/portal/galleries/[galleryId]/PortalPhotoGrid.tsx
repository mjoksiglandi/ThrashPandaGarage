"use client";

import { useState, useTransition } from "react";

export type PortalGalleryPhotoItem = {
  id: string;
  baseName: string;
  selected: boolean;
};

export function PortalPhotoGrid({
  galleryId,
  photos,
  selectionOpen,
}: {
  galleryId: string;
  photos: PortalGalleryPhotoItem[];
  selectionOpen: boolean;
}) {
  const [items, setItems] = useState(photos);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(photo: PortalGalleryPhotoItem) {
    if (!selectionOpen || pendingId) return;
    const nextSelected = !photo.selected;

    setPendingId(photo.id);
    setError(null);
    setItems((current) =>
      current.map((item) => (item.id === photo.id ? { ...item, selected: nextSelected } : item))
    );

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/portal/galleries/${galleryId}/photos/${photo.id}/selection`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ selected: nextSelected }),
          }
        );
        if (!response.ok) {
          setItems((current) =>
            current.map((item) => (item.id === photo.id ? { ...item, selected: photo.selected } : item))
          );
          setError("No se pudo actualizar la selección. Intenta nuevamente.");
        }
      } catch {
        setItems((current) =>
          current.map((item) => (item.id === photo.id ? { ...item, selected: photo.selected } : item))
        );
        setError("No se pudo actualizar la selección. Intenta nuevamente.");
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <>
      {error && (
        <p role="alert" className="portal-selection-error">
          {error}
        </p>
      )}
      {!selectionOpen && (
        <p className="portal-selection-status">La selección está cerrada.</p>
      )}
      <section className="portal-photo-grid">
        {items.map((photo) => (
          <figure className="portal-photo-card" key={photo.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/portal/photos/${photo.id}?variant=thumb`}
              alt={photo.baseName}
              loading="lazy"
            />
            {selectionOpen && (
              <button
                type="button"
                className={`portal-photo-select${photo.selected ? " is-selected" : ""}`}
                aria-pressed={photo.selected}
                aria-label={photo.selected ? "Quitar selección" : "Seleccionar foto"}
                disabled={pendingId === photo.id}
                onClick={() => toggle(photo)}
              >
                {photo.selected ? "Seleccionada" : "Seleccionar"}
              </button>
            )}
          </figure>
        ))}
      </section>
    </>
  );
}
