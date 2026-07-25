import Link from "next/link";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicNav } from "@/components/public/PublicNav";
import { getPublicSessions } from "@/lib/public-sessions";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const sessions = await getPublicSessions();

  return <main><PublicNav active="sessions" /><section className="site-section page-top"><header className="section-heading"><span className="meta accent-text">01 · SESIONES DESTACADAS</span><h1>Historias completas.<br />No fotogramas sueltos.</h1></header>{sessions.length > 0 ? <div className="sessions">{sessions.map((session) => <article className="session" key={session.slug}><Link href={`/sessions/${session.slug}`} className="session__media"><img src={session.cover} alt={`Portada de ${session.name}`} /><span>VER SESIÓN</span></Link><div className="session__copy"><span className="meta">{[session.category, session.date].filter(Boolean).join(" · ")}</span><h2>{session.name}</h2><p>{session.description}</p><Link href={`/sessions/${session.slug}`} className="meta accent-text">VER FOTOGRAFÍAS →</Link></div></article>)}</div> : <p className="sessions-empty">Las próximas sesiones aparecerán aquí.</p>}</section><PublicFooter /></main>;
}
