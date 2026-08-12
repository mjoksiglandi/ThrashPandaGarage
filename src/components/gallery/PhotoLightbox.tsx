"use client";

import type { Photo } from "./gallery.types";

export function PhotoLightbox({
  photo,
  onClose,
  onToggleSelected,
  onCommentChange,
  selectionOpen,
}: {
  photo: Photo;
  onClose: () => void;
  onToggleSelected: (photo: Photo) => void;
  onCommentChange: (photo: Photo, comment: string) => void;
  selectionOpen: boolean;
}) {
  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-[#050506]/95 p-4" onClick={onClose}>
      <div
        className="grid w-full max-w-5xl overflow-hidden rounded-[6px] border border-white/10 bg-[var(--background)] md:grid-cols-[1fr_300px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative grid min-h-[420px] place-items-center bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.previewUrl} alt={photo.baseName} className="max-h-[78vh] object-contain" />
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-black/50 p-0 text-[var(--foreground)]"
          >
            ×
          </button>
          <span className="mono absolute bottom-4 left-4 rounded-[2px] bg-black/50 px-2 py-1 text-[11px] text-[var(--muted-2)]">
            {photo.baseName}
          </span>
        </div>
        <aside className="grid content-start gap-5 border-l border-[var(--line)] p-6">
          <button
            type="button"
            disabled={!selectionOpen}
            onClick={() => onToggleSelected(photo)}
            className={`inline-flex justify-center rounded-[3px] border px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
              photo.selected
                ? "border-[var(--accent)] bg-[oklch(58%_0.11_300_/_0.16)] text-[var(--foreground)]"
                : "border-[var(--line-strong)] text-[var(--muted)]"
            }`}
          >
            {photo.selected ? "✓ Seleccionada" : "Seleccionar foto"}
          </button>
          <div>
            <p className="mono mb-2 text-xs uppercase tracking-[0.05em] text-[var(--muted)]">Comentario</p>
            <textarea
              className="min-h-28 w-full rounded-[3px] border border-[var(--line)] bg-[var(--panel)] p-3 text-sm leading-6 text-[#d8d6dd]"
              placeholder="Comentario"
              value={photo.comment}
              disabled={!selectionOpen}
              onChange={(event) => onCommentChange(photo, event.target.value)}
            />
          </div>
          <p className="mono mt-auto border-t border-[var(--line)] pt-4 text-xs text-[var(--muted-2)]">{photo.filename}</p>
        </aside>
      </div>
    </div>
  );
}
