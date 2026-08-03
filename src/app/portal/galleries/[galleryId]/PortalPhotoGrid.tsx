"use client";

import { useReducer, useTransition } from "react";

export type PortalGalleryPhotoItem = {
  id: string;
  baseName: string;
  selected: boolean;
};

type PortalPhotoGridState = {
  items: PortalGalleryPhotoItem[];
  pendingId: string | null;
  error: string | null;
};

type PortalPhotoGridAction =
  | { type: "toggle"; photoId: string; selected: boolean }
  | { type: "rollback"; photoId: string; selected: boolean }
  | { type: "settled" };

const selectionError = "No se pudo actualizar la selección. Intenta nuevamente.";

export function portalPhotoGridReducer(
  state: PortalPhotoGridState,
  action: PortalPhotoGridAction
): PortalPhotoGridState {
  switch (action.type) {
    case "toggle":
      return {
        items: state.items.map((item) =>
          item.id === action.photoId ? { ...item, selected: action.selected } : item
        ),
        pendingId: action.photoId,
        error: null,
      };
    case "rollback":
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.photoId ? { ...item, selected: action.selected } : item
        ),
        error: selectionError,
      };
    case "settled":
      return { ...state, pendingId: null };
  }
}

export function PortalPhotoGrid({
  galleryId,
  photos,
  selectionOpen,
  selectionLimit,
}: {
  galleryId: string;
  photos: PortalGalleryPhotoItem[];
  selectionOpen: boolean;
  selectionLimit: number | null;
}) {
  const [state, dispatch] = useReducer(portalPhotoGridReducer, {
    items: photos,
    pendingId: null,
    error: null,
  });
  const [, startTransition] = useTransition();
  const selectedCount = state.items.filter((item) => item.selected).length;
  const limitReached = selectionLimit !== null && selectedCount >= selectionLimit;
  const selectionState = !selectionOpen
    ? "Selección cerrada / solo lectura"
    : limitReached
      ? "Selección completa"
      : "Selección abierta";

  function toggle(photo: PortalGalleryPhotoItem) {
    if (!selectionOpen || state.pendingId) return;
    if (!photo.selected && limitReached) return;
    const nextSelected = !photo.selected;

    dispatch({ type: "toggle", photoId: photo.id, selected: nextSelected });

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
          dispatch({ type: "rollback", photoId: photo.id, selected: photo.selected });
        }
      } catch {
        dispatch({ type: "rollback", photoId: photo.id, selected: photo.selected });
      } finally {
        dispatch({ type: "settled" });
      }
    });
  }

  return (
    <>
      <p className="portal-selection-status" aria-live="polite">
        <strong>{selectionState}</strong>
        <span>
          {selectedCount}
          {selectionLimit !== null ? ` / ${selectionLimit}` : ""}{" "}
          {selectedCount === 1 ? "seleccionada" : "seleccionadas"}
        </span>
      </p>
      {state.error && (
        <p role="alert" className="portal-selection-error">
          {state.error}
        </p>
      )}
      <section className="portal-photo-grid">
        {state.items.map((photo) => (
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
                disabled={state.pendingId !== null || (!photo.selected && limitReached)}
                onClick={() => toggle(photo)}
              >
                {photo.selected ? "Seleccionada" : "Seleccionar"}
              </button>
            )}
            {!selectionOpen && photo.selected && (
              <span className="portal-photo-select portal-photo-selection-readonly">
                Seleccionada
              </span>
            )}
          </figure>
        ))}
      </section>
    </>
  );
}
