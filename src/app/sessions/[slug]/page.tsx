import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicNav } from "@/components/public/PublicNav";
import { SessionGallery } from "@/components/public/SessionGallery";
import { getPublicSession } from "@/lib/public-sessions";

type SessionPageProps = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: SessionPageProps): Promise<Metadata> {
  const session = await getPublicSession((await params).slug);
  return session ? { title: session.name, description: session.description } : {};
}

export default async function SessionDetailPage({ params }: SessionPageProps) {
  const session = await getPublicSession((await params).slug);
  if (!session) notFound();

  return <main><PublicNav active="sessions" /><section className="session-detail page-top"><header className="session-detail__header"><Link href="/sessions" className="meta accent-text">← TODAS LAS SESIONES</Link><span className="meta">{[session.category, session.date].filter(Boolean).join(" · ")}</span><h1>{session.name}</h1><p>{session.description}</p></header><SessionGallery images={session.images} sessionName={session.name} /></section><PublicFooter /></main>;
}
