import { PhotoCollage } from "./PhotoCollage";
import { PublicFooter } from "./PublicFooter";
import { PublicNav } from "./PublicNav";
import { publicPortfolioItems } from "./portfolio-data";

export function CategoryPage({ activeKey }: { activeKey: "photo" }) {
  const items = publicPortfolioItems.filter((item) => item.key === activeKey && item.image);
  return <main><PublicNav active={activeKey} /><section className="gallery-intro"><span className="meta accent-text">02 · EDITORIAL GALLERY</span><h1>El muro de la galería.</h1><p>Curado, no generado. Cada fotografía está ubicada como la colgaríamos en una sala.</p></section><section className="gallery-wrap"><PhotoCollage photos={items} /></section><PublicFooter /></main>;
}
