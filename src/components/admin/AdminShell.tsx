import { logoutAdmin, requireAdmin } from "@/lib/auth";
import { AdminSidebar } from "./AdminSidebar";

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  async function logout() {
    "use server";
    await logoutAdmin();
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4efe7]">
      <AdminSidebar adminEmail={admin.email} onLogout={logout} />
      <main className="mx-auto max-w-6xl p-5 md:ml-64 md:p-8">{children}</main>
    </div>
  );
}
