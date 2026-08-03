import { AccountStatus, GalleryEventActorType } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { AccountSessionPrincipal } from "@/modules/account-sessions/current-account-session.service";
import { accountGalleryEventActor } from "./gallery-event-actor";
import { galleryRepository } from "./gallery.repository";

const runId = `gallery_event_account_${Date.now()}`;
const clientIds: string[] = [];

async function createGalleryWithAccount() {
  const client = await db.client.create({ data: { name: runId } });
  clientIds.push(client.id);
  const account = await db.account.create({
    data: {
      clientId: client.id,
      email: `${runId}-${clientIds.length}@example.test`,
      passwordHash: "test-only-hash",
      status: AccountStatus.ACTIVE,
    },
  });
  const gallery = await db.gallery.create({
    data: {
      clientId: client.id,
      title: runId,
      slug: `${runId}-${clientIds.length}`,
      accessToken: `${runId}-${clientIds.length}`,
    },
  });
  const principal: AccountSessionPrincipal = {
    sessionId: `${runId}-session`,
    accountId: account.id,
    clientId: client.id,
    email: account.email,
  };

  return { gallery, principal };
}

afterAll(async () => {
  await db.client.deleteMany({ where: { id: { in: clientIds } } });
  await db.$disconnect();
});

describe("ACCOUNT gallery event actors with PostgreSQL", () => {
  it("persists and reads ACCOUNT alongside the existing actor types", async () => {
    const { gallery, principal } = await createGalleryWithAccount();
    const existingActors = [
      { actorType: GalleryEventActorType.ADMIN, actorId: "admin-1" },
      { actorType: GalleryEventActorType.GALLERY_TOKEN, actorId: null },
      { actorType: GalleryEventActorType.SYSTEM, actorId: null },
    ];

    for (const actor of existingActors) {
      await galleryRepository.event({
        galleryId: gallery.id,
        type: `ACTOR_${actor.actorType}`,
        ...actor,
      });
    }
    await galleryRepository.event({
      galleryId: gallery.id,
      type: "ACTOR_ACCOUNT",
      ...accountGalleryEventActor(principal),
    });

    const events = await db.galleryEvent.findMany({
      where: { galleryId: gallery.id },
      orderBy: { createdAt: "asc" },
    });

    expect(events).toHaveLength(4);
    expect(events.map((event) => event.actorType)).toEqual(
      expect.arrayContaining([
        GalleryEventActorType.ADMIN,
        GalleryEventActorType.ACCOUNT,
        GalleryEventActorType.GALLERY_TOKEN,
        GalleryEventActorType.SYSTEM,
      ])
    );
    expect(events.find((event) => event.actorType === "ACCOUNT")).toMatchObject({
      actorId: principal.accountId,
    });
  });

  it("keeps repository event ordering unchanged", async () => {
    const { gallery, principal } = await createGalleryWithAccount();
    const older = await db.galleryEvent.create({
      data: {
        galleryId: gallery.id,
        type: "ORDER_OLDER",
        actorType: GalleryEventActorType.GALLERY_TOKEN,
        createdAt: new Date("2030-01-01T00:00:00.000Z"),
      },
    });
    const newer = await db.galleryEvent.create({
      data: {
        galleryId: gallery.id,
        type: "ORDER_NEWER",
        ...accountGalleryEventActor(principal),
        createdAt: new Date("2030-01-01T00:00:01.000Z"),
      },
    });

    const found = await galleryRepository.find(gallery.id);
    expect(
      found?.events
        .filter((event) => event.type.startsWith("ORDER_"))
        .map((event) => event.id)
    ).toEqual([newer.id, older.id]);
  });

  it("preserves the gallery foreign-key constraint", async () => {
    await expect(
      galleryRepository.event({
        galleryId: `${runId}-missing`,
        type: "INVALID_GALLERY",
        actorType: GalleryEventActorType.ACCOUNT,
        actorId: `${runId}-account`,
      })
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("rolls back an ACCOUNT event when its transaction fails", async () => {
    const { gallery, principal } = await createGalleryWithAccount();

    await expect(
      db.$transaction(async (tx) => {
        await galleryRepository.event(
          {
            galleryId: gallery.id,
            type: "ACCOUNT_ROLLBACK",
            ...accountGalleryEventActor(principal),
          },
          tx
        );
        throw new Error("rollback account event");
      })
    ).rejects.toThrow("rollback account event");

    await expect(
      db.galleryEvent.count({
        where: { galleryId: gallery.id, type: "ACCOUNT_ROLLBACK" },
      })
    ).resolves.toBe(0);
  });
});
