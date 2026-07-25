import Link from "next/link";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicNav } from "@/components/public/PublicNav";

const services = [
  ["01", "Retratos individuales", "Sesiones cinematográficas alrededor de tu personaje, identidad y atmósfera."], ["02", "Cosplay", "Retratos de personaje con iluminación pensada para honrar el vestuario."], ["03", "Parejas", "Historias compartidas sin poses forzadas; presencia y momentos reales."], ["04", "Proyectos creativos", "Colaboraciones conceptuales para artistas, creadores y pequeñas marcas."], ["05", "Eventos", "Cobertura documental con mirada editorial y atención a los detalles."], ["06", "Grupos", "Sesiones coordinadas para equipos, colectivos y cast completos."],
];
export default function ServicesPage() { return <main><PublicNav active="services" /><section className="site-section page-top"><header className="section-heading"><span className="meta accent-text">03 · SERVICES</span><h1>Formas de trabajar.</h1></header><div className="services-grid">{services.map(([num,title,copy]) => <article key={num}><span className="meta">{num}</span><h2>{title}</h2><p>{copy}</p><span className="meta">DELIVERY · 15–20 DAYS</span><Link href="/contact">Solicitar detalles →</Link></article>)}</div></section><PublicFooter /></main>; }
