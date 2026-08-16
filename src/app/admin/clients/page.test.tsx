import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  listClients: vi.fn(),
  clientTable: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/modules/clients/client.repository", () => ({
  clientRepository: { list: mocks.listClients },
}));
vi.mock("@/components/admin/AdminShell", () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/admin/ClientTable", () => ({
  ClientTable: (props: unknown) => {
    mocks.clientTable(props);
    return <div>client-table</div>;
  },
}));
vi.mock("./actions", () => ({ inviteSelectedClients: vi.fn() }));

import ClientsPage from "./page";

const clients = [
  {
    id: "client-1",
    name: "Ana Uno",
    email: "ana@example.test",
    phone: null,
    notes: null,
    passwordHash: null,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    galleries: [{ id: "gallery-1" }],
    account: null,
  },
  {
    id: "client-2",
    name: "Beto Dos",
    email: "beto@example.test",
    phone: null,
    notes: null,
    passwordHash: null,
    createdAt: new Date("2026-08-02T00:00:00.000Z"),
    updatedAt: new Date("2026-08-02T00:00:00.000Z"),
    galleries: [],
    account: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ id: "admin-1", email: "admin@example.test", role: "ADMIN" });
  mocks.listClients.mockResolvedValue(clients);
});

describe("ClientsPage", () => {
  it("authenticates before listing clients", async () => {
    await ClientsPage({ searchParams: Promise.resolve({}) });

    expect(mocks.requireAdmin.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.listClients.mock.invocationCallOrder[0]
    );
  });

  it("does not list clients when authorization fails", async () => {
    mocks.requireAdmin.mockRejectedValueOnce(new Error("forbidden"));

    await expect(ClientsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("forbidden");
    expect(mocks.listClients).not.toHaveBeenCalled();
  });

  it("preserves the gallery filter in search GET and filters the selectable rows", async () => {
    const html = renderToStaticMarkup(
      await ClientsPage({ searchParams: Promise.resolve({ gallery: "with", q: "ana" }) })
    );

    expect(html).toContain('name="gallery"');
    expect(html).toContain('value="with"');
    expect(html).toContain('name="q"');
    expect(html).toContain('value="ana"');
    expect(mocks.clientTable).toHaveBeenCalledWith(
      expect.objectContaining({ clients: [clients[0]], action: expect.any(Function) })
    );
  });
});
