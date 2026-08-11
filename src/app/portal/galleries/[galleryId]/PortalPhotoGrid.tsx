"use client";

import type { GalleryStatus } from "@prisma/client";
import { useMemo, useReducer, useRef, useState, useTransition } from "react";

export type PortalGalleryPhotoItem = {
  id: string;
  baseName: string;
  selected: boolean;
  comment: string;
};

type PortalPhotoGridState = {
  items: PortalGalleryPhotoItem[];
  pendingId: string | null;
  error: string | null;
};

type PortalPhotoGridAction =
  | { type: "toggle"; photoId: string; selected: boolean }
  | { type: "comment"; photoId: string; comment: string }
  | { type: "rollback"; photoId: string; selected: boolean; comment?: string }
  | { type: "error"; message: string }
  | { type: "settled" };

const selectionError = "No se pudo actualizar la selección. Intenta nuevamente.";
const commentError = "No se pudo guardar el comentario. Intenta nuevamente.";
const confirmationError = "No se pudo enviar la selección. Revisa el límite e intenta nuevamente.";

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
    case "comment":
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.photoId ? { ...item, comment: action.comment } : item
        ),
        error: null,
      };
    case "rollback":
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.photoId
            ? {
                ...item,
                selected: action.selected,
                comment: action.comment ?? item.comment,
              }
            : item
        ),
        error: selectionError,
      };
    case "error":
      return { ...state, error: action.message };
    case "settled":
      return { ...state, pendingId: null };
  }
}

export function portalGalleryFunctionalStatus({
  status,
  selectionOpen,
  confirmed,
  selectedCount,
  selectionLimit,
}: {
  status: GalleryStatus;
  selectionOpen: boolean;
  confirmed: boolean;
  selectedCount: number;
  selectionLimit: number | null;
}) {
  if (status === "DELIVERED") return "Entregada";
  if (status === "READY_FOR_DELIVERY") return "Lista para entrega";
  if (confirmed || status === "SELECTION_CONFIRMED" || status === "EDITING") {
    return "Selección enviada";
  }
  if (selectionOpen) {
    return selectionLimit !== null && selectedCount >= selectionLimit
      ? "Límite alcanzado"
      : "Seleccionando";
  }
  return "Cerrada";
}

export function PortalPhotoGrid({
  galleryId,
  photos,
  status,
  selectionOpen,
  selectionLimit,
  alreadyConfirmed,
}: {
  galleryId: string;
  photos: PortalGalleryPhotoItem[];
  status: GalleryStatus;
  selectionOpen: boolean;
  selectionLimit: number | null;
  alreadyConfirmed: boolean;
}) {
  const [state, dispatch] = useReducer(portalPhotoGridReducer, {
    items: photos,
    pendingId: null,
    error: null,
  });
  const [confirmed, setConfirmed] = useState(alreadyConfirmed);
  const [pending, startTransition] = useTransition();
  const persistedComments = useRef(
    new Map(photos.map((photo) => [photo.id, photo.comment]))
  );
  const selectedCount = useMemo(
    () => state.items.filter((item) => item.selected).length,
    [state.items]
  );
  const limitReached = selectionLimit !== null && selectedCount >= selectionLimit;
  const mutable = selectionOpen && !confirmed;
  const canConfirm =
    mutable &&
    selectedCount > 0 &&
    (selectionLimit === null || selectedCount === selectionLimit);
  const functionalStatus = portalGalleryFunctionalStatus({
    status,
    selectionOpen: mutable,
    confirmed,
    selectedCount,
    selectionLimit,
  });

  async function persistPhoto(
    photo: PortalGalleryPhotoItem,
    selected: boolean,
    comment: string
  ) {
    const response = await fetch(
      `/api/portal/galleries/${galleryId}/photos/${photo.id}/selection`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected, comment }),
      }
    );
    if (!response.ok) throw new Error("Selection update failed");
    persistedComments.current.set(photo.id, comment);
  }

  function toggle(photo: PortalGalleryPhotoItem) {
    if (!mutable || state.pendingId) return;
    if (!photo.selected && limitReached) return;
    const nextSelected = !photo.selected;

    dispatch({ type: "toggle", photoId: photo.id, selected: nextSelected });
    startTransition(async () => {
      try {
        await persistPhoto(photo, nextSelected, photo.comment);
      } catch {
        dispatch({
          type: "rollback",
          photoId: photo.id,
          selected: photo.selected,
        });
      } finally {
        dispatch({ type: "settled" });
      }
    });
  }

  function saveComment(photo: PortalGalleryPhotoItem) {
    if (!mutable || persistedComments.current.get(photo.id) === photo.comment) return;
    const previousComment = persistedComments.current.get(photo.id) ?? "";

    startTransition(async () => {
      try {
        await persistPhoto(photo, photo.selected, photo.comment);
      } catch {
        dispatch({ type: "comment", photoId: photo.id, comment: previousComment });
        dispatch({ type: "error", message: commentError });
      }
    });
  }

  function confirm() {
    if (!canConfirm) return;
    startTransition(async () => {
      try {
        for (const photo of state.items) {
          if (persistedComments.current.get(photo.id) !== photo.comment) {
            await persistPhoto(photo, photo.selected, photo.comment);
          }
        }
        const response = await fetch(`/api/portal/galleries/${galleryId}/confirm`, {
          method: "POST",
        });
        if (!response.ok) throw new Error("Confirmation failed");
        setConfirmed(true);
      } catch {
        dispatch({ type: "error", message: confirmationError });
      }
    });
  }

  return (
    <>
      <p className="portal-selection-status" aria-live="polite">
        <strong>{functionalStatus}</strong>
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
      {mutable && (
        <section className="portal-selection-confirm">
          <p>
            {canConfirm
              ? "Tu selección está lista para enviarse. Después no podrás modificarla."
              : selectionLimit === null
                ? "Selecciona al menos una fotografía para enviar tu selección."
                : `Selecciona exactamente ${selectionLimit} fotografías para continuar.`}
          </p>
          <button type="button" disabled={!canConfirm || pending} onClick={confirm}>
            Confirmar selección
          </button>
        </section>
      )}
      {confirmed && (
        <p className="portal-selection-confirmed">
          Tu selección fue enviada. Ya no admite cambios.
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
            {mutable && (
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
            {!mutable && photo.selected && (
              <span className="portal-photo-select portal-photo-selection-readonly">
                Seleccionada
              </span>
            )}
            <textarea
              className="portal-photo-comment"
              rows={2}
              maxLength={1000}
              aria-label={`Comentario para ${photo.baseName}`}
              placeholder="Comentario"
              value={photo.comment}
              disabled={!mutable}
              onChange={(event) =>
                dispatch({
                  type: "comment",
                  photoId: photo.id,
                  comment: event.target.value,
                })
              }
              onBlur={() => saveComment(photo)}
            />
          </figure>
        ))}
      </section>
    </>
  );
}
