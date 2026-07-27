import { describe, expect, it, vi } from "vitest";
import type { AccountSessionResolution } from "@/modules/account-sessions/current-account-session.service";
import { createPortalActorResolver } from "./portal-actor.service";

const accountPrincipal = {
  accountId: "account-1",
  clientId: "account-client",
  email: "account@example.test",
};

function fixture() {
  const resolveAccountSession = vi.fn<
    () => Promise<AccountSessionResolution>
  >(async () => ({
    kind: "authenticated",
    principal: accountPrincipal,
  }));
  const resolveLegacyClientId = vi.fn<
    (cookie: string) => Promise<string | null>
  >(async () => "legacy-client");
  const resolver = createPortalActorResolver({
    accountSessions: { resolve: resolveAccountSession },
    legacySessions: { resolveClientId: resolveLegacyClientId },
  });
  return { resolver, resolveAccountSession, resolveLegacyClientId };
}

describe("portal actor cutover policy", () => {
  it("gives a valid account session precedence over a different legacy identity", async () => {
    const test = fixture();

    await expect(
      test.resolver.resolve({
        accountSessionCookie: "account-token",
        legacyClientCookie: "legacy-cookie",
      })
    ).resolves.toEqual({
      kind: "account",
      accountId: "account-1",
      clientId: "account-client",
      email: "account@example.test",
    });
    expect(test.resolveLegacyClientId).not.toHaveBeenCalled();
  });

  it.each([
    ["revoked", "revoked-account-token"],
    ["expired", "expired-account-token"],
    ["malformed", "malformed"],
    ["random", "random-account-token"],
    ["empty", ""],
  ])("blocks legacy fallback for a present %s account cookie", async (_, accountSessionCookie) => {
    const test = fixture();
    test.resolveAccountSession.mockResolvedValueOnce({
      kind: "unauthenticated",
    });

    await expect(
      test.resolver.resolve({
        accountSessionCookie,
        legacyClientCookie: "legacy-cookie",
      })
    ).resolves.toEqual({ kind: "anonymous" });
    expect(test.resolveLegacyClientId).not.toHaveBeenCalled();
  });

  it("does not derive legacy identity from an invalid account session", async () => {
    const test = fixture();
    test.resolveAccountSession.mockResolvedValueOnce({
      kind: "unauthenticated",
    });

    await expect(
      test.resolver.resolve({
        accountSessionCookie: "revoked-account-token",
      })
    ).resolves.toEqual({ kind: "anonymous" });
    expect(test.resolveLegacyClientId).not.toHaveBeenCalled();
  });

  it("preserves existing legacy access when no account cookie is present", async () => {
    const test = fixture();

    await expect(
      test.resolver.resolve({ legacyClientCookie: "legacy-cookie" })
    ).resolves.toEqual({
      kind: "legacy",
      clientId: "legacy-client",
    });
    expect(test.resolveAccountSession).not.toHaveBeenCalled();
  });

  it("does not authenticate an invalid legacy cookie", async () => {
    const test = fixture();
    test.resolveLegacyClientId.mockResolvedValueOnce(null);

    await expect(
      test.resolver.resolve({ legacyClientCookie: "invalid" })
    ).resolves.toEqual({ kind: "anonymous" });
  });

  it("returns an unambiguous anonymous actor when neither cookie exists", async () => {
    const test = fixture();

    await expect(test.resolver.resolve({})).resolves.toEqual({
      kind: "anonymous",
    });
    expect(test.resolveAccountSession).not.toHaveBeenCalled();
    expect(test.resolveLegacyClientId).not.toHaveBeenCalled();
  });
});
