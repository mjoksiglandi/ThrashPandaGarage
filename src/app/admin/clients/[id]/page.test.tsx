import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findClient: vi.fn(),
  createAccount: vi.fn(),
  resendInvitation: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/components/admin/AdminShell", () => ({
  AdminShell: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/modules/clients/client.repository", () => ({
  clientRepository: { find: mocks.findClient },
}));
vi.mock("@/modules/accounts/client-account-admin", () => ({
  ClientAccountAlreadyExistsError: class extends Error {},
  ClientAccountEmailAlreadyUsedError: class extends Error {},
  ClientAccountEmailRequiredError: class extends Error {},
  createClientAccountAndInvite: mocks.createAccount,
  resendClientAccountInvitation: mocks.resendInvitation,
}));
vi.mock("@/modules/clients/client.service", () => ({
  updateClientFromForm: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import ClientDetailPage from "./page";

const baseClient = {
  id: "client-1",
  name: "Client One",
  email: "client@example.test",
  phone: null,
  notes: null,
  galleries: [],
  account: null,
  createdAt: new Date("2026-08-10T10:00:00.000Z"),
  updatedAt: new Date("2026-08-10T10:00:00.000Z"),
  passwordHash: null,
};

function textContent(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(textContent).join(" ");
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node || typeof node !== "object" || !("props" in node)) return "";
  return textContent((node as ReactElement<{ children?: ReactNode }>).props.children);
}

function findFormAction(node: ReactNode, buttonLabel: string): () => Promise<void> {
  if (!node || typeof node !== "object" || !("props" in node)) {
    throw new Error(`Form ${buttonLabel} not found`);
  }
  const element = node as ReactElement<{
    action?: () => Promise<void>;
    children?: ReactNode;
    label?: string;
  }>;
  if (
    (element.type === "form" && textContent(element).includes(buttonLabel)) ||
    element.props.label === buttonLabel
  ) {
    if (typeof element.props.action !== "function") throw new Error("Missing action");
    return element.props.action;
  }
  const children = Array.isArray(element.props.children)
    ? element.props.children
    : [element.props.children];
  for (const child of children) {
    try {
      return findFormAction(child, buttonLabel);
    } catch {
      // Keep searching sibling branches.
    }
  }
  throw new Error(`Form ${buttonLabel} not found`);
}

async function renderPage() {
  return ClientDetailPage({
    params: Promise.resolve({ id: "client-1" }),
    searchParams: Promise.resolve({}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({
    id: "admin-1",
    email: "admin@example.test",
    role: "ADMIN",
  });
  mocks.findClient.mockResolvedValue(baseClient);
  mocks.createAccount.mockResolvedValue(undefined);
  mocks.resendInvitation.mockResolvedValue(undefined);
});

describe("ClientDetailPage account administration", () => {
  it("authenticates before reading the client", async () => {
    await renderPage();

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.requireAdmin.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.findClient.mock.invocationCallOrder[0]
    );
  });

  it("shows the active status, account email, invitation and activation", async () => {
    mocks.findClient.mockResolvedValue({
      ...baseClient,
      account: {
        id: "account-1",
        email: "account@example.test",
        status: "ACTIVE",
        invitations: [
          {
            id: "invitation-1",
            createdAt: new Date("2026-08-10T11:00:00.000Z"),
            acceptedAt: new Date("2026-08-10T12:00:00.000Z"),
          },
        ],
      },
    });

    const page = await renderPage();
    const text = textContent(page);

    expect(text).toContain("Cuenta activa");
    expect(text).toContain("account@example.test");
    expect(text).toContain("Fecha de invitación");
    expect(text).toContain("Activación");
    expect(text).not.toContain("Reenviar invitación");
  });

  it("authenticates the create action before passing the admin actor", async () => {
    const page = await renderPage();
    const action = findFormAction(page, "Crear cuenta e invitar");
    mocks.requireAdmin.mockClear();

    await action();

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.createAccount).toHaveBeenCalledWith({
      clientId: "client-1",
      actorId: "admin-1",
    });
    expect(mocks.requireAdmin.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createAccount.mock.invocationCallOrder[0]
    );
  });

  it("does not mutate when action authentication fails", async () => {
    const page = await renderPage();
    const action = findFormAction(page, "Crear cuenta e invitar");
    mocks.requireAdmin.mockRejectedValueOnce(new Error("unauthorized"));

    await expect(action()).rejects.toThrow("unauthorized");
    expect(mocks.createAccount).not.toHaveBeenCalled();
  });
});
