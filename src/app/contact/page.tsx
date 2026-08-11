import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicNav } from "@/components/public/PublicNav";
import { ContactForm } from "./ContactForm";

export default function ContactPage() {
  return <main><PublicNav active="contact" /><section className="site-section contact-page"><header className="section-heading"><span className="meta accent-text">05 · CONTACT</span><h1>Hagamos algo.</h1><p>Cuéntame tu idea. Las sesiones se reservan con un mes de anticipación — sin presión, sin obligación.</p></header><ContactForm /><div className="contact-links"><a href="https://www.instagram.com/gormm___/" target="_blank" rel="noreferrer">INSTAGRAM</a><a href="mailto:juan.cornejo.s@gmail.com">EMAIL</a></div></section><PublicFooter /></main>;
}
