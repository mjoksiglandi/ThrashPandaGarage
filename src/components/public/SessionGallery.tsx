"use client";

import { useEffect, useState } from "react";

export function SessionGallery({ images, sessionName }: { images: string[]; sessionName: string }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    if (activeIndex === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveIndex(null);
      if (event.key === "ArrowLeft") setActiveIndex((index) => index === null ? null : (index - 1 + images.length) % images.length);
      if (event.key === "ArrowRight") setActiveIndex((index) => index === null ? null : (index + 1) % images.length);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [activeIndex, images.length]);

  const move = (step: number) => setActiveIndex((index) => index === null ? null : (index + step + images.length) % images.length);

  return <>
    <div className="session-instagram-grid">
      {images.map((image, index) => <button type="button" key={image} onClick={() => setActiveIndex(index)} aria-label={`Abrir fotografía ${index + 1} de ${sessionName}`}><img src={image} alt={`${sessionName}, fotografía ${index + 1}`} loading={index < 6 ? "eager" : "lazy"} /></button>)}
    </div>
    {activeIndex !== null && <div className="session-lightbox" role="dialog" aria-modal="true" aria-label={`Fotografía ${activeIndex + 1} de ${images.length}`} onClick={() => setActiveIndex(null)}>
      <button type="button" className="session-lightbox__close" aria-label="Cerrar" onClick={() => setActiveIndex(null)}>×</button>
      {images.length > 1 && <button type="button" className="session-lightbox__previous" aria-label="Fotografía anterior" onClick={(event) => { event.stopPropagation(); move(-1); }}>‹</button>}
      <img src={images[activeIndex]} alt={`${sessionName}, fotografía ${activeIndex + 1}`} onClick={(event) => event.stopPropagation()} />
      {images.length > 1 && <button type="button" className="session-lightbox__next" aria-label="Fotografía siguiente" onClick={(event) => { event.stopPropagation(); move(1); }}>›</button>}
      <span className="meta">{activeIndex + 1} / {images.length}</span>
    </div>}
  </>;
}
