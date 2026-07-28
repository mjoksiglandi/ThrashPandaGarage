import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  redirect: vi.fn((location: string) => {
    throw new Error(`redirect:${location}`);
  }),
  resolveAccount: vi.fn(),
  logoutAccount: vi.fn(),
  findClient: vi.fn(),
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
  mocks.findClient.mockImplementation(async (id: string) => ({
    id,
    name: id,
    galleries: [],
  }));
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
    expect(mocks.findClient).toHaveBeenCalledWith("account-client");
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
    expect(mocks.findClient).not.toHaveBeenCalled();
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
    expect(mocks.findClient).not.toHaveBeenCalled();
  });

  it("redirects when an account points to a missing client", async () => {
    mocks.cookies.mockResolvedValue(
      cookieStore({ tpg_account_session: "account-token" })
    );
    mocks.findClient.mockResolvedValueOnce(null);

    await expect(requirePortalClient()).rejects.toThrow(
      "redirect:/login"
    );
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
