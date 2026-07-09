import Link from "next/link";

export function PublicNav() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
      <Link href="/" className="font-black uppercase tracking-wide">Trashpanda Garage</Link>
      <nav className="flex gap-4 text-sm text-zinc-300">
        <Link href="/work">Work</Link>
        <Link href="/contact">Contacto</Link>
        <Link href="/admin">Admin</Link>
      </nav>
    </header>
  );
}
