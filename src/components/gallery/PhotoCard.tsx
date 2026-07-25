"use client";

import type { Photo } from "./gallery.types";

export function PhotoCard({
  photo,
  onOpen,
  onToggleSelected,
  onCommentChange,
  selectionOpen,
}: {
  photo: Photo;
  onOpen: (photo: Photo) => void;
  onToggleSelected: (photo: Photo) => void;
  onCommentChange: (photo: Photo, comment: string) => void;
  selectionOpen: boolean;
}) {
  return (
    <article
      className={`relative overflow-hidden rounded-[3px] border bg-[var(--panel)] ${
        photo.selected ? "border-[var(--accent)]" : "border-[var(--line)]"
      }`}
    >
      <button type="button" onClick={() => onOpen(photo)} className="block w-full overflow-hidden border-0 bg-transparent p-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.thumbUrl} alt={photo.baseName} className="aspect-[4/5] w-full object-cover" />
      </button>
      <button
        type="button"
        aria-label={photo.selected ? "Quitar seleccion" : "Seleccionar foto"}
        className={`absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full p-0 text-sm ${
          photo.selected
            ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--background)]"
            : "border-white/30 bg-[rgba(12,12,13,0.6)] text-[var(--foreground)]"
        }`}
        onClick={() => onToggleSelected(photo)}
        disabled={!selectionOpen}
      >
        {photo.selected ? "✓" : ""}
      </button>
      {photo.comment.trim().length > 0 && (
        <span className="absolute bottom-[54px] left-2 grid h-6 w-6 place-items-center rounded-full border border-white/20 bg-[rgba(12,12,13,0.75)] text-xs text-[#d8d6dd]">
          ✎
        </span>
      )}
      <div className="flex items-center justify-between gap-2 bg-[var(--panel)] px-2.5 py-2">
        <span className="mono truncate text-[10.5px] text-[var(--muted-2)]">{photo.baseName}</span>
      </div>
      <textarea
        className="min-h-16 rounded-none border-x-0 border-b-0 border-t border-[var(--line)] bg-[var(--panel)] text-sm"
        rows={2}
        placeholder="Comentario"
        value={photo.comment}
        onChange={(event) => onCommentChange(photo, event.target.value)}
        disabled={!selectionOpen}
      />
    </article>
  );
}
