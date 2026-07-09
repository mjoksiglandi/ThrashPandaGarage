import { PublicNav } from "@/components/public/PublicNav";

export default function ContactPage() {
  return (
    <main>
      <PublicNav />
      <section className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-4xl font-black">Contacto</h1>
        <p className="mt-4 text-zinc-400">Para sesiones, props, FX o builds raros, escribe a Trashpanda Garage.</p>
        <div className="mt-8 rounded-lg border border-zinc-800 bg-[#141417] p-6 text-zinc-300">
          Configura el correo publico definitivo antes de publicar.
        </div>
      </section>
    </main>
  );
}
