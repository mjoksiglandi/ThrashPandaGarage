"use client";

import type { Photo } from "./gallery.types";
import { PhotoCommentBox } from "./PhotoCommentBox";

export function PhotoCard({
  photo,
  onOpen,
  onToggleSelected,
  onCommentChange,
}: {
  photo: Photo;
  onOpen: (photo: Photo) => void;
  onToggleSelected: (photo: Photo) => void;
  onCommentChange: (photo: Photo, comment: string) => void;
}) {
  return (
    <article className={`rounded-lg border bg-[#141417] p-2 ${photo.selected ? "border-[#d9902f]" : "border-zinc-800"}`}>
      <button type="button" onClick={() => onOpen(photo)} className="block w-full overflow-hidden rounded-md border-0 bg-transparent p-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.thumbUrl} alt={photo.baseName} className="aspect-square w-full object-cover" />
      </button>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="truncate text-sm text-zinc-300">{photo.baseName}</span>
        <button type="button" className={photo.selected ? "" : "secondary"} onClick={() => onToggleSelected(photo)}>
          {photo.selected ? "OK" : "Elegir"}
        </button>
      </div>
      <PhotoCommentBox comment={photo.comment} onChange={(comment) => onCommentChange(photo, comment)} />
    </article>
  );
}
