import Link from "next/link";
import { PublicNav } from "@/components/public/PublicNav";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,#172554,transparent_30%),#09090b]">
      <PublicNav />
      <section className="mx-auto grid min-h-[70vh] max-w-6xl content-center px-5 py-16">
        <p className="mb-4 text-sm uppercase tracking-[0.35em] text-[#d9902f]">Creative garage</p>
        <h1 className="max-w-4xl text-5xl font-black leading-tight md:text-7xl">Trashpanda Garage</h1>
        <p className="mt-6 max-w-2xl text-xl text-zinc-300">
          Foto, props, FX y cosas raras hechas con carino. Un taller visual para sesiones,
          making-of, builds e ideas que no caben en un portfolio limpio de bodas.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="button" href="/work">Ver trabajo</Link>
          <Link className="button secondary" href="/contact">Contacto</Link>
        </div>
      </section>
    </main>
  );
}
