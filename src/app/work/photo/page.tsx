import { PublicNav } from "@/components/public/PublicNav";
export default function PhotoPage() {
  return <Category title="Photo" copy="Galeria base para fotografia. En V1 queda lista para poblar con proyectos destacados." />;
}
function Category({ title, copy }: { title: string; copy: string }) {
  return <main><PublicNav /><section className="mx-auto max-w-6xl px-5 py-12"><h1 className="text-4xl font-black">{title}</h1><p className="mt-4 text-zinc-400">{copy}</p></section></main>;
}
