import { AccountStatus, GalleryStatus, PhotoStatus } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { clientRepository } from "@/modules/clients/client.repository";
import { galleryRepository } from "@/modules/galleries/gallery.repository";
import { photoRepository } from "@/modules/photos/photo.repository";
import { createAccountClientAccessService } from "./account-client-access.service";

const runId = `portal_gallery_photos_${Date.now()}`;
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
  overrides: { status?: GalleryStatus; expiresAt?: Date | null } = {}
) {
  return db.gallery.create({
    data: {
      clientId,
      title: `${runId}_${label}`,
      slug: `${runId}_${label}`,
      accessToken: `${runId}_${label}`,
      status: overrides.status ?? GalleryStatus.PROOFING,
      expiresAt: overrides.expiresAt ?? null,
    },
  });
}

async function createPhoto(
  galleryId: string,
  label: string,
  overrides: { status?: PhotoStatus; sortOrder?: number } = {}
) {
  return db.photo.create({
    data: {
      galleryId,
      filename: `${runId}_${label}.jpg`,
      baseName: `${runId}_${label}`,
      thumbPath: `${runId}/${label}/thumb.jpg`,
      status: overrides.status ?? PhotoStatus.PROOF,
      sortOrder: overrides.sortOrder ?? 0,
    },
  });
}

const access = createAccountClientAccessService({
  clients: clientRepository,
  galleries: galleryRepository,
  clock: { now: () => now },
});
afterAll(async () => {
  await db.client.deleteMany({ where: { id: { in: clientIds } } });
  await db.$disconnect();
});

describe("Authenticated portal gallery photo isolation with PostgreSQL", () => {
  it("returns only the authorized gallery's available photos, in deterministic order, excluding rejected and cross-gallery/cross-client photos", async () => {
    const ownerA = await createAccountClient("a");
    const ownerB = await createAccountClient("b");

    const galleryA1 = await createGallery(ownerA.client.id, "a1");
    const galleryA2 = await createGallery(ownerA.client.id, "a2");
    const galleryB1 = await createGallery(ownerB.client.id, "b1");

    const second = await createPhoto(galleryA1.id, "a1-second", {
      sortOrder: 2,
    });
    const first = await createPhoto(galleryA1.id, "a1-first", {
      sortOrder: 1,
    });
    const rejected = await createPhoto(galleryA1.id, "a1-rejected", {
      sortOrder: 0,
      status: PhotoStatus.REJECTED,
    });
    const sameClientOtherGallery = await createPhoto(
      galleryA2.id,
      "a2-same-client"
    );
    const otherClient = await createPhoto(galleryB1.id, "b1-other-client");

    const authorized = await access.findGallery(ownerA.principal, galleryA1.id);
    expect(authorized).toMatchObject({ id: galleryA1.id });

    const photos = await photoRepository.listAvailableForGallery(authorized!.id);
    const photoIds = photos.map((photo) => photo.id);

    expect(photoIds).toEqual([first.id, second.id]);
    expect(photoIds).not.toContain(rejected.id);
    expect(photoIds).not.toContain(sameClientOtherGallery.id);
    expect(photoIds).not.toContain(otherClient.id);
  });

  it("stops before any photo becomes visible when gallery authorization fails for a foreign client", async () => {
    const ownerA = await createAccountClient("iso-a");
    const ownerB = await createAccountClient("iso-b");
    const galleryB = await createGallery(ownerB.client.id, "iso-b1");
    await createPhoto(galleryB.id, "iso-b1-photo");

    const authorized = await access.findGallery(ownerA.principal, galleryB.id);

    expect(authorized).toBeNull();
  });

  it("returns the same authorization outcome for an archived gallery as for a foreign one", async () => {
    const owner = await createAccountClient("archived");
    const archivedGallery = await createGallery(owner.client.id, "archived-1", {
      status: GalleryStatus.ARCHIVED,
    });
    await createPhoto(archivedGallery.id, "archived-1-photo");

    const authorized = await access.findGallery(owner.principal, archivedGallery.id);

    expect(authorized).toBeNull();
  });

  it("returns the same authorization outcome for an expired gallery", async () => {
    const owner = await createAccountClient("expired");
    const expiredGallery = await createGallery(owner.client.id, "expired-1", {
      expiresAt: new Date(now.getTime() - 1000),
    });
    await createPhoto(expiredGallery.id, "expired-1-photo");

    const authorized = await access.findGallery(owner.principal, expiredGallery.id);

    expect(authorized).toBeNull();
  });
});
