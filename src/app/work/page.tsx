import Link from "next/link";
import { PublicNav } from "@/components/public/PublicNav";

const sections = [
  ["Photo", "/work/photo", "Retratos, cosplay, producto y escenas construidas."],
  ["Props", "/work/props", "Objetos, piezas, replicas y material de taller."],
  ["FX", "/work/fx", "Maquillaje, texturas, sangre falsa y trucos visuales."],
  ["Builds", "/work/builds", "Impresion 3D, pruebas, making-of y procesos."],
];

export default function WorkPage() {
  return (
    <main>
      <PublicNav />
      <section className="mx-auto max-w-6xl px-5 py-12">
        <h1 className="text-4xl font-black">Work</h1>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {sections.map(([title, href, copy]) => (
            <Link key={href} href={href} className="rounded-lg border border-zinc-800 bg-[#141417] p-6">
              <h2 className="text-2xl font-bold">{title}</h2>
              <p className="mt-3 text-zinc-400">{copy}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
