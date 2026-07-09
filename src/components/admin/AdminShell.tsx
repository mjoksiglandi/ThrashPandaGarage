import Link from "next/link";
import { logoutAdmin, requireAdmin } from "@/lib/auth";

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  async function logout() {
    "use server";
    await logoutAdmin();
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4efe7]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-zinc-800 bg-[#101013] p-6 md:block">
        <Link href="/admin" className="block text-xl font-black uppercase tracking-wide">
          Trashpanda
        </Link>
        <p className="mt-1 text-xs text-zinc-500">Garage admin</p>
        <nav className="mt-10 grid gap-3 text-sm text-zinc-300">
          <Link href="/admin/clients">Clientes</Link>
          <Link href="/admin/galleries">Galerias</Link>
          <Link href="/">Sitio publico</Link>
        </nav>
        <form action={logout} className="absolute bottom-6 left-6 right-6">
          <p className="mb-3 truncate text-xs text-zinc-500">{admin.email}</p>
          <button className="secondary w-full" type="submit">Salir</button>
        </form>
      </aside>
      <main className="mx-auto max-w-6xl p-5 md:ml-64 md:p-8">{children}</main>
    </div>
  );
}
