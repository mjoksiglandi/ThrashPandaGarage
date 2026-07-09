"use client";

import type { Photo } from "./gallery.types";
import { PhotoCard } from "./PhotoCard";

export function GalleryGrid({
  photos,
  onOpen,
  onToggleSelected,
  onCommentChange,
}: {
  photos: Photo[];
  onOpen: (photo: Photo) => void;
  onToggleSelected: (photo: Photo) => void;
  onCommentChange: (photo: Photo, comment: string) => void;
}) {
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {photos.map((photo) => (
        <PhotoCard
          key={photo.id}
          photo={photo}
          onOpen={onOpen}
          onToggleSelected={onToggleSelected}
          onCommentChange={onCommentChange}
        />
      ))}
    </div>
  );
}
