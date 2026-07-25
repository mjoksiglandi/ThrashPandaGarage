"use client";

import { useEffect } from "react";
import type { PhotoItem } from "./photo-collage-layout";

export function PhotoCollageLightbox({
  photo,
  onClose,
  onPrevious,
  onNext,
}: {
  photo: PhotoItem;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onPrevious();
      if (event.key === "ArrowRight") onNext();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, onNext, onPrevious]);

  return (
    <div
      className="fixed inset-0 z-[300] grid place-items-center bg-black/95 p-3 md:p-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <button type="button" aria-label="Cerrar foto" onClick={onClose} className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full border-white/25 bg-black/50 p-0 text-[var(--foreground)]">x</button>
      <button type="button" aria-label="Foto anterior" onClick={(event) => { event.stopPropagation(); onPrevious(); }} className="absolute left-4 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border-white/25 bg-black/50 p-0 text-[var(--foreground)]">{"<"}</button>
      <img src={photo.image} alt={photo.alt} className="h-auto max-h-[92vh] w-auto max-w-[94vw] object-contain" onClick={(event) => event.stopPropagation()} />
      <button type="button" aria-label="Foto siguiente" onClick={(event) => { event.stopPropagation(); onNext(); }} className="absolute right-4 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border-white/25 bg-black/50 p-0 text-[var(--foreground)]">{">"}</button>
    </div>
  );
}
