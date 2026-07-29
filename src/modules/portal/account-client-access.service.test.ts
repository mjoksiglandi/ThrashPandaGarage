import { describe, expect, it, vi } from "vitest";
import type { AccountSessionPrincipal } from "@/modules/account-sessions/current-account-session.service";
import { createAccountClientAccessService } from "./account-client-access.service";

const now = new Date("2030-01-02T03:04:05.000Z");
const principal: AccountSessionPrincipal = {
  sessionId: "session-a",
  accountId: "account-a",
  clientId: "client-a",
  email: "a@example.test",
};

function fixture() {
  const findLinkedToAccount = vi.fn<
    (
      accountId: string,
      clientId: string
    ) => Promise<{ id: string; name: string } | null>
  >(async () => ({
    id: "client-a",
    name: "Client A",
  }));
  const listAvailableForClient = vi.fn(async () => [
    {
      id: "gallery-a",
      title: "Gallery A",
      accessToken: "token-a",
      status: "PROOFING" as const,
      createdAt: new Date("2029-12-01T00:00:00.000Z"),
    },
  ]);
  const findAvailableForClient = vi.fn(async () => null);
  const service = createAccountClientAccessService({
    clients: { findLinkedToAccount },
    galleries: {
      listAvailableForClient,
      findAvailableForClient,
    },
    clock: { now: () => now },
  });

  return {
    service,
    findLinkedToAccount,
    listAvailableForClient,
    findAvailableForClient,
  };
}

describe("Account-Client portal access", () => {
  it("lists galleries only with the clientId from the validated principal", async () => {
    const test = fixture();
    const browserControlledInput = {
      ...principal,
      requestedClientId: "client-b",
    };

    await expect(
      test.service.listGalleries(browserControlledInput)
    ).resolves.toMatchObject({
      client: { id: "client-a" },
      galleries: [{ id: "gallery-a" }],
    });
    expect(test.findLinkedToAccount).toHaveBeenCalledWith(
      "account-a",
      "client-a"
    );
    expect(test.listAvailableForClient).toHaveBeenCalledWith(
      "client-a",
      now
    );
  });

  it("fails closed without querying galleries when the Account-Client relation is broken", async () => {
    const test = fixture();
    test.findLinkedToAccount.mockResolvedValueOnce(null);

    await expect(test.service.listGalleries(principal)).resolves.toBeNull();
    expect(test.listAvailableForClient).not.toHaveBeenCalled();
  });

  it("scopes resource lookup and returns the same public result for foreign and unknown galleries", async () => {
    const test = fixture();

    const foreign = await test.service.findGallery(principal, "gallery-b");
    const unknown = await test.service.findGallery(
      principal,
      "gallery-missing"
    );

    expect(foreign).toBeNull();
    expect(unknown).toBeNull();
    expect(test.findAvailableForClient).toHaveBeenNthCalledWith(
      1,
      "gallery-b",
      "client-a",
      now
    );
    expect(test.findAvailableForClient).toHaveBeenNthCalledWith(
      2,
      "gallery-missing",
      "client-a",
      now
    );
  });
});
