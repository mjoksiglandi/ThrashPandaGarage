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
      <main className="min-w-0 p-4 pt-24 sm:p-6 sm:pt-24 md:ml-[240px] md:p-8 md:pt-24 xl:p-10">
        <div className="mx-auto w-full max-w-[1440px]">{children}</div>
      </main>
    </div>
  );
}
