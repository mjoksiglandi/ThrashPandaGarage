import { logoutAdmin, requireAdmin } from "@/lib/auth";
import { AdminSidebar } from "./AdminSidebar";

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  async function logout() {
    "use server";
    await requireAdmin();
    await logoutAdmin();
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <AdminSidebar adminEmail={admin.email} onLogout={logout} />
      <main className="mx-auto max-w-6xl p-5 md:ml-[230px] md:p-8">{children}</main>
    </div>
  );
}
