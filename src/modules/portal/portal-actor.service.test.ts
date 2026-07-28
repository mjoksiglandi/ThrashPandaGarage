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
    (token: string | undefined) => Promise<AccountSessionResolution>
  >(async () => ({
    kind: "authenticated",
    principal: accountPrincipal,
  }));
  const resolver = createPortalActorResolver({
    accountSessions: { resolve: resolveAccountSession },
  });
  return { resolver, resolveAccountSession };
}

describe("account-only portal actor policy", () => {
  it("uses the client linked to a valid account session", async () => {
    const test = fixture();

    await expect(
      test.resolver.resolve("account-token")
    ).resolves.toEqual({
      kind: "account",
      accountId: "account-1",
      clientId: "account-client",
      email: "account@example.test",
    });
  });

  it.each([
    ["missing", undefined],
    ["revoked", "revoked-account-token"],
    ["expired", "expired-account-token"],
    ["malformed", "malformed"],
  ])("returns anonymous for a %s account session", async (_, token) => {
    const test = fixture();
    test.resolveAccountSession.mockResolvedValueOnce({
      kind: "unauthenticated",
    });

    await expect(test.resolver.resolve(token)).resolves.toEqual({
      kind: "anonymous",
    });
  });
});
