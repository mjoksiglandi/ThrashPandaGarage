import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  listClients: vi.fn(),
  listGalleries: vi.fn(),
  recentEvents: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/components/admin/AdminShell", () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/modules/clients/client.repository", () => ({
  clientRepository: { list: mocks.listClients },
}));
vi.mock("@/modules/galleries/gallery.repository", () => ({
  galleryRepository: { list: mocks.listGalleries, recentEvents: mocks.recentEvents },
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
  mocks.recentEvents.mockResolvedValue([]);
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
      { status: "EDITING" },
      { status: "READY_FOR_DELIVERY" },
      { status: "DELIVERED" },
      { status: "ARCHIVED" },
    ]);

    const html = renderToStaticMarkup(await AdminPage());

    expect(html).toContain("Clientes");
    expect(html).toContain("Galerías activas");
    expect(html).toContain("Selecciones pendientes");
    expect(html).toContain("En edición");
    expect(html).toContain("Entregas disponibles");
    expect(html).toContain("Próx. a expirar");
    expect(html).toContain('href="/admin/galleries?status=PROOFING"');
    expect(html).not.toContain("Sin abrir aún");
  });

  it("counts only galleries that are still operationally open as active", async () => {
    mocks.listClients.mockResolvedValue([]);
    mocks.listGalleries.mockResolvedValue([
      { status: "PROOFING" },
      { status: "EDITING" },
      { status: "DELIVERED" },
      { status: "ARCHIVED" },
    ]);

    const html = renderToStaticMarkup(await AdminPage());
    const activeCell = html.split("Galerías activas")[0];

    expect(activeCell).toContain(">2<");
  });
});
