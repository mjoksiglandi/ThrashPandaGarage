"use client";

import type { Photo } from "./gallery.types";
import { PhotoCard } from "./PhotoCard";

export function GalleryGrid({
  photos,
  onOpen,
  onToggleSelected,
  onCommentChange,
  selectionOpen,
}: {
  photos: Photo[];
  onOpen: (photo: Photo) => void;
  onToggleSelected: (photo: Photo) => void;
  onCommentChange: (photo: Photo, comment: string) => void;
  selectionOpen: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {photos.map((photo) => (
        <PhotoCard
          key={photo.id}
          photo={photo}
          onOpen={onOpen}
          onToggleSelected={onToggleSelected}
          onCommentChange={onCommentChange}
          selectionOpen={selectionOpen}
        />
      ))}
    </div>
  );
}
