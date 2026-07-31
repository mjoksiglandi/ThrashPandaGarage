import { describe, expect, it, vi } from "vitest";
import type { GalleryStatus } from "@prisma/client";
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
      expiresAt: null,
      deliveryDriveUrl: null,
    },
  ]);
  const findAvailableForClient = vi.fn<
    (
      id: string,
      clientId: string,
      now: Date
    ) => Promise<{
      id: string;
      title: string;
      status: GalleryStatus;
      createdAt: Date;
      expiresAt: Date | null;
      deliveryDriveUrl: string | null;
    } | null>
  >(async () => null);
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

describe("Authenticated gallery delivery lookup", () => {
  it("returns the gallery with deliveryDriveUrl for an authorized account", async () => {
    const test = fixture();
    test.findAvailableForClient.mockResolvedValueOnce({
      id: "gallery-a",
      title: "Gallery A",
      status: "READY_FOR_DELIVERY",
      createdAt: new Date("2029-12-01T00:00:00.000Z"),
      expiresAt: null,
      deliveryDriveUrl: "https://drive.example.test/gallery-a",
    });

    await expect(
      test.service.findGallery(principal, "gallery-a")
    ).resolves.toMatchObject({
      id: "gallery-a",
      deliveryDriveUrl: "https://drive.example.test/gallery-a",
      selectionOpen: false,
    });
    expect(test.findAvailableForClient).toHaveBeenCalledWith(
      "gallery-a",
      "client-a",
      now
    );
  });

  it("fails closed when the account's client link does not match the gallery's client", async () => {
    const test = fixture();
    test.findLinkedToAccount.mockResolvedValueOnce(null);

    await expect(
      test.service.findGallery(principal, "gallery-a")
    ).resolves.toBeNull();
    expect(test.findAvailableForClient).not.toHaveBeenCalled();
  });

  it("does not resolve an archived gallery", async () => {
    const test = fixture();
    test.findAvailableForClient.mockResolvedValueOnce(null);

    await expect(
      test.service.findGallery(principal, "gallery-archived")
    ).resolves.toBeNull();
  });

  it("does not resolve an expired gallery", async () => {
    const test = fixture();
    test.findAvailableForClient.mockResolvedValueOnce(null);

    await expect(
      test.service.findGallery(principal, "gallery-expired")
    ).resolves.toBeNull();
  });

  it("never includes accessToken in the authorized projection", async () => {
    const test = fixture();
    test.findAvailableForClient.mockResolvedValueOnce({
      id: "gallery-a",
      title: "Gallery A",
      status: "DELIVERED",
      createdAt: new Date("2029-12-01T00:00:00.000Z"),
      expiresAt: null,
      deliveryDriveUrl: "https://drive.example.test/gallery-a",
    });

    const result = await test.service.findGallery(principal, "gallery-a");

    expect(result).not.toHaveProperty("accessToken");
    expect(JSON.stringify(result)).not.toContain("accessToken");
  });
});

describe("Authenticated gallery selection state", () => {
  it("uses the shared workflow policy for an open PROOFING gallery", async () => {
    const test = fixture();
    test.findAvailableForClient.mockResolvedValueOnce({
      id: "gallery-a",
      title: "Gallery A",
      status: "PROOFING",
      createdAt: new Date("2029-12-01T00:00:00.000Z"),
      expiresAt: new Date(now.getTime() + 1),
      deliveryDriveUrl: null,
    });

    await expect(
      test.service.findGallery(principal, "gallery-a")
    ).resolves.toMatchObject({ selectionOpen: true });
  });

  it.each(["READY_FOR_DELIVERY", "DELIVERED"] as const)(
    "closes selection for %s",
    async (status) => {
      const test = fixture();
      test.findAvailableForClient.mockResolvedValueOnce({
        id: "gallery-a",
        title: "Gallery A",
        status,
        createdAt: new Date("2029-12-01T00:00:00.000Z"),
        expiresAt: null,
        deliveryDriveUrl: "https://drive.example.test/gallery-a",
      });

      await expect(
        test.service.findGallery(principal, "gallery-a")
      ).resolves.toMatchObject({ selectionOpen: false });
    }
  );

  it("closes selection when a PROOFING gallery has expired", async () => {
    const test = fixture();
    test.findAvailableForClient.mockResolvedValueOnce({
      id: "gallery-a",
      title: "Gallery A",
      status: "PROOFING",
      createdAt: new Date("2029-12-01T00:00:00.000Z"),
      expiresAt: now,
      deliveryDriveUrl: null,
    });

    await expect(
      test.service.findGallery(principal, "gallery-a")
    ).resolves.toMatchObject({ selectionOpen: false });
  });
});
