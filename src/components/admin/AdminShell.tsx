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
    <div className="admin-app">
      <AdminSidebar adminEmail={admin.email} onLogout={logout} />
      <main className="admin-main">
        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
}
