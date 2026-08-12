import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  listClients: vi.fn(),
  listGalleries: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/components/admin/AdminShell", () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/modules/clients/client.repository", () => ({
  clientRepository: { list: mocks.listClients },
}));
vi.mock("@/modules/galleries/gallery.repository", () => ({
  galleryRepository: { list: mocks.listGalleries },
}));

import AdminPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({
    id: "admin-1",
    email: "admin@example.com",
    role: "ADMIN",
  });
  mocks.listClients.mockResolvedValue([]);
  mocks.listGalleries.mockResolvedValue([]);
});

describe("AdminPage", () => {
  it("authenticates before reading dashboard data", async () => {
    await AdminPage();

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.requireAdmin.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.listClients.mock.invocationCallOrder[0]
    );
    expect(mocks.requireAdmin.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.listGalleries.mock.invocationCallOrder[0]
    );
  });

  it("does not read dashboard data when authentication fails", async () => {
    mocks.requireAdmin.mockRejectedValueOnce(new Error("unauthorized"));

    await expect(AdminPage()).rejects.toThrow("unauthorized");

    expect(mocks.listClients).not.toHaveBeenCalled();
    expect(mocks.listGalleries).not.toHaveBeenCalled();
  });

  it("derives every metric from the current repositories", async () => {
    mocks.listClients.mockResolvedValue([{ id: "client-1" }, { id: "client-2" }]);
    mocks.listGalleries.mockResolvedValue([
      { status: "PROOFING" },
      { status: "SELECTION_CONFIRMED" },
      { status: "READY_FOR_DELIVERY" },
      { status: "DELIVERED" },
      { status: "ARCHIVED" },
    ]);

    const html = renderToStaticMarkup(await AdminPage());

    expect(html).toContain("Clientes");
    expect(html).toContain("Selección abierta");
    expect(html).toContain("Selección confirmada");
    expect(html).toContain("Listas para entrega");
    expect(html).toContain("Entregadas / archivadas");
    expect(html).toContain('href="/admin/galleries?status=PROOFING"');
  });
});
