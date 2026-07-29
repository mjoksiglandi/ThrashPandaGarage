import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const currentSessionId = "c123456789012345678901234";
const otherSessionId = "c223456789012345678901234";
const mocks = vi.hoisted(() => ({
  requirePortalAccount: vi.fn(),
  listSessions: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/modules/portal/portal-access", () => ({
  requirePortalAccount: mocks.requirePortalAccount,
  logoutPortalActor: mocks.logout,
}));
vi.mock("@/modules/account-sessions/account-session-management", () => ({
  listActiveAccountSessions: mocks.listSessions,
}));
vi.mock("./SessionRevokeButton", () => ({
  SessionRevokeButton: ({ current }: { current: boolean }) => (
    <button type="submit">
      {current ? "Cerrar esta sesión" : "Cerrar sesión"}
    </button>
  ),
}));

import AccountSessionsPage from "./page";

const actor = {
  kind: "account" as const,
  sessionId: currentSessionId,
  accountId: "account-a",
  clientId: "client-a",
  email: "a@example.test",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePortalAccount.mockResolvedValue(actor);
  mocks.listSessions.mockResolvedValue([
    {
      id: currentSessionId,
      createdAt: new Date("2030-01-01T00:00:00.000Z"),
      expiresAt: new Date("2030-02-01T00:00:00.000Z"),
      current: true,
    },
    {
      id: otherSessionId,
      createdAt: new Date("2029-12-01T00:00:00.000Z"),
      expiresAt: new Date("2030-01-15T00:00:00.000Z"),
      current: false,
    },
  ]);
});

describe("/portal/sessions", () => {
  it("lists active sessions, marks current, and emits only opaque ID actions", async () => {
    const html = renderToStaticMarkup(await AccountSessionsPage());

    expect(mocks.listSessions).toHaveBeenCalledWith(actor);
    expect(html).toContain("Sesión actual");
    expect(html).toContain("Otra sesión de tu cuenta");
    expect(html).toContain(
      `/api/account-sessions/${currentSessionId}/revoke`
    );
    expect(html).toContain(
      `/api/account-sessions/${otherSessionId}/revoke`
    );
    expect(html).not.toMatch(
      /tokenHash|passwordHash|accessToken|tpg_account_session/
    );
  });

  it("renders the empty state", async () => {
    mocks.listSessions.mockResolvedValueOnce([]);

    const html = renderToStaticMarkup(await AccountSessionsPage());

    expect(html).toContain("No hay sesiones activas.");
  });

  it("does not list anything before the portal authorization boundary", async () => {
    mocks.requirePortalAccount.mockRejectedValueOnce(
      new Error("redirect:/login")
    );

    await expect(AccountSessionsPage()).rejects.toThrow(
      "redirect:/login"
    );
    expect(mocks.listSessions).not.toHaveBeenCalled();
  });
});
