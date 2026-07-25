import { GalleryStatus } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { InvalidGalleryTransitionError } from "./gallery.errors";
import { transitionGallery, updateGalleryFromForm } from "./gallery.service";

const runId = `gallery_admin_${Date.now()}`;
const clientIds: string[] = [];

async function createDraftGallery() {
  const client = await db.client.create({
    data: { name: runId },
  });
  clientIds.push(client.id);

  return db.gallery.create({
    data: {
      clientId: client.id,
      title: runId,
      slug: `${runId}-${clientIds.length}`,
      accessToken: `${runId}-${clientIds.length}`,
      status: GalleryStatus.DRAFT,
    },
  });
}

afterAll(async () => {
  await db.client.deleteMany({ where: { id: { in: clientIds } } });
  await db.$disconnect();
});

describe("administrative gallery transitions with PostgreSQL row locks", () => {
  it("serializes concurrent transitions against the latest persisted status", async () => {
    const gallery = await createDraftGallery();

    const results = await Promise.allSettled([
      transitionGallery(gallery.id, GalleryStatus.EMAIL_SENT, { actorId: "admin-1" }),
      transitionGallery(gallery.id, GalleryStatus.PROOFING, { actorId: "admin-2" }),
    ]);

    const persisted = await db.gallery.findUniqueOrThrow({ where: { id: gallery.id } });
    const events = await db.galleryEvent.findMany({
      where: { galleryId: gallery.id, type: "GALLERY_TRANSITIONED" },
      orderBy: { createdAt: "asc" },
    });
    const metadata = events.map(
      (event) => event.metadata as { fromStatus: GalleryStatus; toStatus: GalleryStatus }
    );

    expect(metadata.filter((event) => event.fromStatus === GalleryStatus.DRAFT)).toHaveLength(1);
    expect(events).toHaveLength(results.filter((result) => result.status === "fulfilled").length);

    if (events.length === 2) {
      expect(metadata).toEqual(
        expect.arrayContaining([
          { fromStatus: GalleryStatus.DRAFT, toStatus: GalleryStatus.EMAIL_SENT },
          { fromStatus: GalleryStatus.EMAIL_SENT, toStatus: GalleryStatus.PROOFING },
        ])
      );
      expect(persisted.status).toBe(GalleryStatus.PROOFING);
    } else {
      expect(events).toHaveLength(1);
      expect(results.find((result) => result.status === "rejected")).toMatchObject({
        reason: expect.any(InvalidGalleryTransitionError),
      });
      expect(persisted.status).toBe(metadata[0].toStatus);
    }

    for (const event of events) {
      expect(event.actorType).toBe("ADMIN");
      expect(event.actorId).toMatch(/^admin-[12]$/);
    }
  });

  it("emits one event for two concurrent requests targeting the same status", async () => {
    const gallery = await createDraftGallery();

    const results = await Promise.all([
      transitionGallery(gallery.id, GalleryStatus.PROOFING, { actorId: "admin-1" }),
      transitionGallery(gallery.id, GalleryStatus.PROOFING, { actorId: "admin-2" }),
    ]);

    expect(results.map((result) => result.status)).toEqual([
      GalleryStatus.PROOFING,
      GalleryStatus.PROOFING,
    ]);
    expect(
      await db.galleryEvent.count({
        where: { galleryId: gallery.id, type: "GALLERY_TRANSITIONED" },
      })
    ).toBe(1);
  });

  it("does not lower selectionLimit below the persisted selected count", async () => {
    const gallery = await createDraftGallery();
    const photos = await Promise.all(
      ["proof-1", "proof-2"].map((baseName, index) =>
        db.photo.create({
          data: {
            galleryId: gallery.id,
            filename: `${baseName}.jpg`,
            baseName,
            thumbPath: `${baseName}.jpg`,
            sortOrder: index,
          },
        })
      )
    );
    await db.selection.createMany({
      data: photos.map((photo) => ({
        galleryId: gallery.id,
        photoId: photo.id,
        selected: true,
      })),
    });
    await db.gallery.update({
      where: { id: gallery.id },
      data: { selectionLimit: 3 },
    });

    const formData = new FormData();
    formData.set("clientId", gallery.clientId);
    formData.set("title", gallery.title);
    formData.set("slug", gallery.slug);
    formData.set("selectionLimit", "1");

    await expect(
      updateGalleryFromForm(gallery.id, formData, {
        actorId: "admin-limit",
      })
    ).rejects.toBeInstanceOf(InvalidGalleryTransitionError);

    expect(
      await db.gallery.findUniqueOrThrow({ where: { id: gallery.id } })
    ).toMatchObject({ selectionLimit: 3 });
    expect(
      await db.galleryEvent.count({
        where: { galleryId: gallery.id, type: "GALLERY_UPDATED" },
      })
    ).toBe(0);
  });
});
