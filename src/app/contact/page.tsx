import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicNav } from "@/components/public/PublicNav";

export default function ContactPage() {
  return <main><PublicNav active="contact" /><section className="site-section contact-page"><header className="section-heading"><span className="meta accent-text">05 · CONTACT</span><h1>Hagamos algo.</h1><p>Cuéntame tu idea. Las sesiones se reservan con un mes de anticipación — sin presión, sin obligación.</p></header><form className="contact-form"><div className="form-row"><Field label="Nombre"><input type="text" /></Field><Field label="Correo"><input type="email" /></Field></div><Field label="Tipo de sesión"><select defaultValue="Retrato"><option>Retrato</option><option>Cosplay</option><option>Editorial</option><option>Evento</option></select></Field><Field label="Tu idea"><textarea rows={5} placeholder="Personaje, ánimo, referencias, fechas..." /></Field><button type="button" className="solid-btn">Enviar mensaje</button></form><div className="contact-links"><a href="https://www.instagram.com/gormm___/" target="_blank" rel="noreferrer">INSTAGRAM</a><a href="mailto:juan.cornejo.s@gmail.com">EMAIL</a></div></section><PublicFooter /></main>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="meta">{label}</span>{children}</label>; }
