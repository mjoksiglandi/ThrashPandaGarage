import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  redirect: vi.fn((location: string) => {
    throw new Error(`redirect:${location}`);
  }),
  resolveAccount: vi.fn(),
  logoutAccount: vi.fn(),
  resolveLegacy: vi.fn(),
  findClient: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/account-sessions/current-account-session", () => ({
  resolveAccountSessionToken: mocks.resolveAccount,
  logoutAccountSessionToken: mocks.logoutAccount,
}));
vi.mock("@/lib/client-auth", () => ({
  LEGACY_CLIENT_COOKIE_NAME: "tpg_client",
  resolveLegacyClientId: mocks.resolveLegacy,
}));
vi.mock("@/modules/clients/client.repository", () => ({
  clientRepository: {
    find: mocks.findClient,
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
    delete: vi.fn(),
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
  mocks.resolveLegacy.mockResolvedValue("legacy-client");
  mocks.findClient.mockImplementation(async (id: string) => ({
    id,
    name: id,
    galleries: [],
  }));
});

describe("productive portal actor wiring", () => {
  it("uses the account actor and linked client when both cookies exist", async () => {
    mocks.cookies.mockResolvedValue(
      cookieStore({
        tpg_account_session: "account-token",
        tpg_client: "legacy-cookie",
      })
    );

    await expect(requirePortalClient()).resolves.toMatchObject({
      actor: {
        kind: "account",
        accountId: "account-1",
        clientId: "account-client",
      },
      client: { id: "account-client" },
    });
    expect(mocks.resolveLegacy).not.toHaveBeenCalled();
    expect(mocks.findClient).toHaveBeenCalledWith("account-client");
  });

  it("preserves the legacy actor only without an account cookie", async () => {
    mocks.cookies.mockResolvedValue(
      cookieStore({ tpg_client: "legacy-cookie" })
    );

    await expect(resolveCurrentPortalActor()).resolves.toEqual({
      kind: "legacy",
      clientId: "legacy-client",
    });
    expect(mocks.resolveAccount).not.toHaveBeenCalled();
  });

  it("blocks legacy identity switching when the new session is invalid", async () => {
    mocks.cookies.mockResolvedValue(
      cookieStore({
        tpg_account_session: "revoked-token",
        tpg_client: "legacy-cookie",
      })
    );
    mocks.resolveAccount.mockResolvedValueOnce({
      kind: "unauthenticated",
    });

    await expect(requirePortalClient()).rejects.toThrow(
      "redirect:/portal/login"
    );
    expect(mocks.resolveLegacy).not.toHaveBeenCalled();
    expect(mocks.findClient).not.toHaveBeenCalled();
  });

  it("does not derive a legacy actor from an invalid account session", async () => {
    mocks.cookies.mockResolvedValue(
      cookieStore({
        tpg_account_session: "revoked-token",
      })
    );
    mocks.resolveAccount.mockResolvedValueOnce({
      kind: "unauthenticated",
    });

    await expect(requirePortalClient()).rejects.toThrow(
      "redirect:/portal/login"
    );
    expect(mocks.resolveLegacy).not.toHaveBeenCalled();
  });

  it("does not fall back when an account points to a missing client", async () => {
    mocks.cookies.mockResolvedValue(
      cookieStore({
        tpg_account_session: "account-token",
        tpg_client: "legacy-cookie",
      })
    );
    mocks.findClient.mockResolvedValueOnce(null);

    await expect(requirePortalClient()).rejects.toThrow(
      "redirect:/portal/login"
    );
    expect(mocks.resolveLegacy).not.toHaveBeenCalled();
  });

  it("revokes the account session and clears both transition cookies", async () => {
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
    expect(jar.delete).toHaveBeenCalledWith("tpg_client");
  });
});
