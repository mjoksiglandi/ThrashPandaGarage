import { logoutAdmin, requireAdmin } from "@/lib/auth";
import { galleryRepository } from "@/modules/galleries/gallery.repository";
import { AdminSidebar } from "./AdminSidebar";

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const attentionCount = await galleryRepository.countByStatus("PROOFING");

  async function logout() {
    "use server";
    await requireAdmin();
    await logoutAdmin();
  }

  return (
    <div className="admin-app">
      <AdminSidebar adminEmail={admin.email} onLogout={logout} attentionCount={attentionCount} />
      <main className="admin-main">
        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
}
