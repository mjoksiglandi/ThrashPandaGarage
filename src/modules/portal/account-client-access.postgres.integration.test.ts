import { AccountStatus, GalleryStatus } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { clientRepository } from "@/modules/clients/client.repository";
import { galleryRepository } from "@/modules/galleries/gallery.repository";
import { createAccountClientAccessService } from "./account-client-access.service";

const runId = `account_client_access_${Date.now()}`;
const now = new Date("2030-01-02T03:04:05.000Z");
const clientIds: string[] = [];

async function createAccountClient(label: string) {
  const client = await db.client.create({
    data: { name: `${runId}_${label}` },
  });
  clientIds.push(client.id);
  const account = await db.account.create({
    data: {
      clientId: client.id,
      email: `${runId}_${label}@example.test`,
      passwordHash: "fixture-hash",
      status: AccountStatus.ACTIVE,
    },
  });
  return {
    client,
    account,
    principal: {
      sessionId: "session-fixture",
      accountId: account.id,
      clientId: client.id,
      email: account.email,
    },
  };
}

async function createGallery(
  clientId: string,
  label: string,
  overrides: {
    status?: GalleryStatus;
    expiresAt?: Date | null;
    deliveryDriveUrl?: string | null;
  } = {}
) {
  return db.gallery.create({
    data: {
      clientId,
      title: `${runId}_${label}`,
      slug: `${runId}_${label}`,
      accessToken: `${runId}_${label}`,
      status: overrides.status ?? GalleryStatus.PROOFING,
      expiresAt: overrides.expiresAt ?? null,
      deliveryDriveUrl: overrides.deliveryDriveUrl ?? null,
    },
  });
}

const service = createAccountClientAccessService({
  clients: clientRepository,
  galleries: galleryRepository,
  clock: { now: () => now },
});

afterAll(async () => {
  await db.client.deleteMany({ where: { id: { in: clientIds } } });
  await db.$disconnect();
});

describe("Account-Client gallery isolation with PostgreSQL", () => {
  it("isolates two Accounts and filters archived and expiresAt <= now in PostgreSQL", async () => {
    const ownerA = await createAccountClient("a");
    const ownerB = await createAccountClient("b");
    const activeA = await createGallery(ownerA.client.id, "active-a");
    const futureA = await createGallery(ownerA.client.id, "future-a", {
      expiresAt: new Date(now.getTime() + 1),
    });
    await createGallery(ownerA.client.id, "archived-a", {
      status: GalleryStatus.ARCHIVED,
    });
    await createGallery(ownerA.client.id, "expires-now-a", {
      expiresAt: now,
    });
    const activeB = await createGallery(ownerB.client.id, "active-b");

    const browserControlledInput = {
      ...ownerA.principal,
      requestedClientId: ownerB.client.id,
    };
    const resultA = await service.listGalleries(browserControlledInput);
    const resultB = await service.listGalleries(ownerB.principal);

    expect(resultA?.galleries.map(({ id }) => id)).toEqual([
      futureA.id,
      activeA.id,
    ]);
    expect(resultB?.galleries.map(({ id }) => id)).toEqual([activeB.id]);
  });

  it("returns the same result for another client's gallery and an unknown id", async () => {
    const ownerA = await createAccountClient("lookup-a");
    const ownerB = await createAccountClient("lookup-b");
    const galleryB = await createGallery(
      ownerB.client.id,
      "lookup-gallery-b"
    );

    const foreign = await service.findGallery(
      ownerA.principal,
      galleryB.id
    );
    const unknown = await service.findGallery(
      ownerA.principal,
      `${runId}_missing`
    );

    expect(foreign).toBeNull();
    expect(unknown).toBeNull();
    await expect(
      service.findGallery(ownerB.principal, galleryB.id)
    ).resolves.toMatchObject({ id: galleryB.id });
  });

  it("resolves deliveryDriveUrl through the single authorized query for the matching Account-Client pair", async () => {
    const ownerA = await createAccountClient("delivery-a");
    const ownerB = await createAccountClient("delivery-b");
    const readyA = await createGallery(ownerA.client.id, "ready-a", {
      status: GalleryStatus.READY_FOR_DELIVERY,
      deliveryDriveUrl: "https://drive.example.test/ready-a",
    });
    await createGallery(ownerA.client.id, "archived-delivery-a", {
      status: GalleryStatus.ARCHIVED,
      deliveryDriveUrl: "https://drive.example.test/archived-a",
    });
    await createGallery(ownerA.client.id, "expired-delivery-a", {
      status: GalleryStatus.READY_FOR_DELIVERY,
      expiresAt: now,
      deliveryDriveUrl: "https://drive.example.test/expired-a",
    });

    const findGallerySpy = vi.spyOn(galleryRepository, "findAvailableForClient");

    const authorized = await service.findGallery(ownerA.principal, readyA.id);
    const otherClient = await service.findGallery(ownerB.principal, readyA.id);

    expect(authorized).toMatchObject({
      id: readyA.id,
      deliveryDriveUrl: "https://drive.example.test/ready-a",
      selectionOpen: false,
    });
    expect(authorized).not.toHaveProperty("accessToken");
    expect(otherClient).toBeNull();
    expect(findGallerySpy).toHaveBeenCalledTimes(2);

    findGallerySpy.mockRestore();
  });
});
