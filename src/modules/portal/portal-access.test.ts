import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  redirect: vi.fn((location: string) => {
    throw new Error(`redirect:${location}`);
  }),
  resolveAccount: vi.fn(),
  logoutAccount: vi.fn(),
  findLinkedClient: vi.fn(),
  listAvailableGalleries: vi.fn(),
  findAvailableGallery: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/account-sessions/current-account-session", () => ({
  resolveAccountSessionToken: mocks.resolveAccount,
  logoutAccountSessionToken: mocks.logoutAccount,
}));
vi.mock("@/modules/clients/client.repository", () => ({
  clientRepository: {
    findLinkedToAccount: mocks.findLinkedClient,
  },
}));
vi.mock("@/modules/galleries/gallery.repository", () => ({
  galleryRepository: {
    listAvailableForClient: mocks.listAvailableGalleries,
    findAvailableForClient: mocks.findAvailableGallery,
  },
}));

import {
  logoutPortalActor,
  requirePortalClient,
  resolveCurrentPortalActor,
} from "./portal-access";

function cookieStore(values: Record<string, string> = {}) {
  return {
    get: vi.fn((name: string) =>
      values[name] === undefined
        ? undefined
        : { name, value: values[name] }
    ),
    set: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveAccount.mockResolvedValue({
    kind: "authenticated",
    principal: {
      accountId: "account-1",
      clientId: "account-client",
      email: "account@example.test",
    },
  });
  mocks.findLinkedClient.mockImplementation(
    async (_accountId: string, clientId: string) => ({
      id: clientId,
      name: clientId,
    })
  );
  mocks.listAvailableGalleries.mockResolvedValue([
    {
      id: "gallery-1",
      title: "Gallery",
      accessToken: "gallery-token",
      status: "PROOFING",
      createdAt: new Date("2030-01-01T00:00:00.000Z"),
    },
  ]);
  mocks.findAvailableGallery.mockResolvedValue(null);
});

describe("account-only portal access", () => {
  it("uses only the account cookie even when a legacy cookie exists", async () => {
    const jar = cookieStore({
      tpg_account_session: "account-token",
      tpg_client: "legacy-cookie",
    });
    mocks.cookies.mockResolvedValue(jar);

    await expect(requirePortalClient()).resolves.toMatchObject({
      actor: {
        kind: "account",
        accountId: "account-1",
        clientId: "account-client",
      },
      client: { id: "account-client" },
    });
    expect(jar.get).toHaveBeenCalledWith("tpg_account_session");
    expect(jar.get).not.toHaveBeenCalledWith("tpg_client");
    expect(mocks.findLinkedClient).toHaveBeenCalledWith(
      "account-1",
      "account-client"
    );
    expect(mocks.listAvailableGalleries).toHaveBeenCalledWith(
      "account-client",
      expect.any(Date)
    );
  });

  it("rejects a legacy cookie when no account session exists", async () => {
    const jar = cookieStore({ tpg_client: "legacy-cookie" });
    mocks.cookies.mockResolvedValue(jar);
    mocks.resolveAccount.mockResolvedValueOnce({
      kind: "unauthenticated",
    });

    await expect(resolveCurrentPortalActor()).resolves.toEqual({
      kind: "anonymous",
    });
    expect(mocks.resolveAccount).toHaveBeenCalledWith(undefined);
    expect(jar.get).not.toHaveBeenCalledWith("tpg_client");
    expect(mocks.findLinkedClient).not.toHaveBeenCalled();
    expect(mocks.listAvailableGalleries).not.toHaveBeenCalled();
  });

  it("redirects invalid account sessions to the canonical login", async () => {
    mocks.cookies.mockResolvedValue(
      cookieStore({ tpg_account_session: "revoked-token" })
    );
    mocks.resolveAccount.mockResolvedValueOnce({
      kind: "unauthenticated",
    });

    await expect(requirePortalClient()).rejects.toThrow(
      "redirect:/login"
    );
    expect(mocks.findLinkedClient).not.toHaveBeenCalled();
    expect(mocks.listAvailableGalleries).not.toHaveBeenCalled();
  });

  it("redirects when an account points to a missing client", async () => {
    mocks.cookies.mockResolvedValue(
      cookieStore({ tpg_account_session: "account-token" })
    );
    mocks.findLinkedClient.mockResolvedValueOnce(null);

    await expect(requirePortalClient()).rejects.toThrow(
      "redirect:/login"
    );
    expect(mocks.listAvailableGalleries).not.toHaveBeenCalled();
  });

  it("revokes the account session and expires both cookies", async () => {
    const jar = cookieStore({
      tpg_account_session: "account-token",
      tpg_client: "legacy-cookie",
    });
    mocks.cookies.mockResolvedValue(jar);

    await logoutPortalActor();

    expect(mocks.logoutAccount).toHaveBeenCalledWith("account-token");
    expect(jar.set).toHaveBeenCalledWith(
      "tpg_account_session",
      "",
      expect.objectContaining({
        httpOnly: true,
        path: "/",
        maxAge: 0,
      })
    );
    expect(jar.set).toHaveBeenCalledWith(
      "tpg_client",
      "",
      expect.objectContaining({
        httpOnly: true,
        path: "/",
        maxAge: 0,
      })
    );
  });
});
