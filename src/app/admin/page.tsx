import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { clientRepository } from "@/modules/clients/client.repository";
import { galleryRepository } from "@/modules/galleries/gallery.repository";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [clients, galleries] = await Promise.all([clientRepository.list(), galleryRepository.list()]);
  return (
    <AdminShell>
      <h1 className="text-3xl font-black">Panel admin</h1>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Card label="Clientes" value={clients.length} href="/admin/clients" />
        <Card label="Galerias" value={galleries.length} href="/admin/galleries" />
        <Card label="Pendientes" value={galleries.filter((g) => g.status !== "ARCHIVED" && g.status !== "DELIVERED").length} href="/admin/galleries" />
      </div>
    </AdminShell>
  );
}

function Card({ label, value, href }: { label: string; value: number; href: string }) {
  return <Link href={href} className="rounded-lg border border-zinc-800 bg-[#141417] p-6"><p className="text-sm text-zinc-500">{label}</p><p className="mt-2 text-4xl font-black">{value}</p></Link>;
}
