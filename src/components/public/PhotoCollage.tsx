"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PhotoCollageLightbox } from "./PhotoCollageLightbox";
import { buildCollage, buildJustifiedRows, type CollagePhoto, type PhotoItem } from "./photo-collage-layout";

const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
function dateLabel(value?: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day} ${months[Number(month) - 1]} ${year}`;
}


export function PhotoCollage({ photos }: { photos: PhotoItem[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [collagePhotos, setCollagePhotos] = useState<CollagePhoto[]>(() => buildCollage(photos, false));
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const [galleryWidth, setGalleryWidth] = useState(0);
  const galleryRef = useRef<HTMLDivElement>(null);
  const activePhoto = activeIndex === null ? null : photos[activeIndex];

  const rows = useMemo(() => buildJustifiedRows(
    collagePhotos.map((photo) => ({ ...photo, ratio: ratios[photo.image] || 0.8 })),
    galleryWidth,
  ), [collagePhotos, galleryWidth, ratios]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setCollagePhotos(buildCollage(photos)));
    return () => window.cancelAnimationFrame(frame);
  }, [photos]);

  useEffect(() => {
    const gallery = galleryRef.current;
    if (!gallery) return;
    const updateWidth = () => setGalleryWidth(gallery.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(gallery);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all(collagePhotos.map((photo) => new Promise<[string, number]>((resolve) => {
      const image = new Image();
      image.onload = () => resolve([photo.image, image.naturalWidth / image.naturalHeight]);
      image.onerror = () => resolve([photo.image, 0.8]);
      image.src = photo.image;
    }))).then((entries) => {
      if (!cancelled) setRatios(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, [collagePhotos]);

  const goToPrevious = () => setActiveIndex((index) => (index === null ? index : (index - 1 + photos.length) % photos.length));
  const goToNext = () => setActiveIndex((index) => (index === null ? index : (index + 1) % photos.length));

  return (
    <>
      <div className="editorial-gallery justified-gallery" ref={galleryRef}>
        {rows.map((row, rowIndex) => <div className="justified-gallery__row" key={`${rowIndex}-${row.photos[0]?.image}`} style={{ height: row.height }}>
          {row.photos.map((photo) => (
            <button
              key={photo.image}
              type="button"
              aria-label={`Abrir ${photo.title}`}
              onClick={() => setActiveIndex(photo.originalIndex)}
              className="gallery-tile"
              style={{ width: photo.ratio * row.height }}
            >
              <img src={photo.image} alt={photo.alt} /><span><b>{photo.exifText || "EXIF NO DISPONIBLE"}</b><small>{dateLabel(photo.captureDate)}</small></span>
            </button>
          ))}
        </div>)}
      </div>

      {activePhoto && activeIndex !== null && <PhotoCollageLightbox photo={activePhoto} onClose={() => setActiveIndex(null)} onPrevious={goToPrevious} onNext={goToNext} />}
    </>
  );
}
