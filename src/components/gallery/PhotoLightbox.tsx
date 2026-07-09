"use client";

import type { Photo } from "./gallery.types";

export function PhotoLightbox({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/90 p-4" onClick={onClose}>
      <div className="max-h-full max-w-5xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.previewUrl} alt={photo.baseName} className="max-h-[85vh] rounded-lg object-contain" />
      </div>
    </div>
  );
}
