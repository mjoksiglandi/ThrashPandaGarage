"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type HeroPhoto = { title: string; image: string; alt: string; exifText?: string };

function shufflePhotos(photos: HeroPhoto[]) {
  const shuffled = [...photos];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

export function FeaturedCarousel({ photos }: { photos: readonly HeroPhoto[] }) {
  const [slides, setSlides] = useState(() => photos.slice(0, 10));
  const [active, setActive] = useState(0);
  const move = useCallback((direction: number) => setActive((index) => (index + direction + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setSlides((currentSlides) => shufflePhotos(currentSlides)));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => move(1), 7500);
    return () => window.clearInterval(timer);
  }, [move]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  if (!slides.length) return null;
  return (
    <section className="hero" aria-label="Fotografía destacada">
      {slides.map((photo, index) => <div key={photo.image} className={`hero__slide ${index === active ? "active" : ""}`}><img src={photo.image} alt={photo.alt} /></div>)}
      <div className="hero__overlay" />
      <div className="hero__content">
        <h1>TRASHPANDA<br />GARAGE</h1>
        <p>CINEMATIC PORTRAITS · COSPLAY · CREATIVE PHOTOGRAPHY</p>
        <div><Link href="/work/photo" className="solid-btn">Ver portfolio</Link><Link href="/contact" className="outline-btn">Reservar sesión</Link></div>
      </div>
      <button className="hero__arrow prev" type="button" aria-label="Imagen anterior" onClick={() => move(-1)}>←</button>
      <button className="hero__arrow next" type="button" aria-label="Imagen siguiente" onClick={() => move(1)}>→</button>
      <span className="hero__caption">{slides[active].exifText || "EXIF NO DISPONIBLE"}</span>
      <span className="hero__count">{String(active + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span>
      <div className="hero__progress" key={active} />
    </section>
  );
}
