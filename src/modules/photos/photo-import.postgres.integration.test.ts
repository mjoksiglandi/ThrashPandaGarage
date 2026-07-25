import fs from "fs/promises";
import { mkdtempSync } from "fs";
import os from "os";
import path from "path";
import { GalleryStatus } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { GalleryUnavailableError } from "@/modules/galleries/gallery.errors";

const runId = `photo_import_${Date.now()}`;
const storageRoot = mkdtempSync(path.join(os.tmpdir(), `${runId}_`));
process.env.PHOTO_STORAGE_ROOT = storageRoot;

const {
  importGalleryPhotos,
  PhotoImportValidationError,
} = await import("./photo-import.service");

const clientIds: string[] = [];
let gallerySequence = 0;

async function createGallery(files: string[], thumbnailLocalPath?: string) {
  gallerySequence += 1;
  const client = await db.client.create({ data: { name: `${runId}_${gallerySequence}` } });
  clientIds.push(client.id);

  const relativeFolder =
    thumbnailLocalPath ?? `${runId}/${gallerySequence}/thumbs`;
  if (!thumbnailLocalPath) {
    const absoluteFolder = path.join(storageRoot, ...relativeFolder.split("/"));
    await fs.mkdir(absoluteFolder, { recursive: true });
    await Promise.all(
      files.map((filename) => fs.writeFile(path.join(absoluteFolder, filename), "test image"))
    );
  }

  const gallery = await db.gallery.create({
    data: {
      clientId: client.id,
      title: `${runId}_${gallerySequence}`,
      slug: `${runId}_${gallerySequence}`,
      accessToken: `${runId}_${gallerySequence}`,
      thumbnailLocalPath: relativeFolder,
    },
  });

  return {
    gallery,
    absoluteFolder: path.join(storageRoot, ...relativeFolder.split("/")),
  };
}

async function installPhotoFailureTrigger() {
  await db.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION "slice0_fail_photo_import_upsert"()
    RETURNS trigger AS $$
    BEGIN
      IF NEW."baseName" = '02-fail' THEN
        RAISE EXCEPTION 'forced second photo upsert failure';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);
  await db.$executeRawUnsafe(`
    CREATE TRIGGER "slice0_fail_photo_import_upsert_trigger"
    BEFORE INSERT OR UPDATE ON "Photo"
    FOR EACH ROW EXECUTE FUNCTION "slice0_fail_photo_import_upsert"()
  `);
}

async function removePhotoFailureTrigger() {
  await db.$executeRawUnsafe(
    `DROP TRIGGER IF EXISTS "slice0_fail_photo_import_upsert_trigger" ON "Photo"`
  );
  await db.$executeRawUnsafe(
    `DROP FUNCTION IF EXISTS "slice0_fail_photo_import_upsert"()`
  );
}

async function installEventFailureTrigger() {
  await db.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION "slice0_fail_photo_import_event"()
    RETURNS trigger AS $$
    BEGIN
      IF NEW."type" = 'PHOTOS_IMPORTED' AND NEW."actorId" = 'fail-event' THEN
        RAISE EXCEPTION 'forced photo import event failure';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);
  await db.$executeRawUnsafe(`
    CREATE TRIGGER "slice0_fail_photo_import_event_trigger"
    BEFORE INSERT ON "GalleryEvent"
    FOR EACH ROW EXECUTE FUNCTION "slice0_fail_photo_import_event"()
  `);
}

async function removeEventFailureTrigger() {
  await db.$executeRawUnsafe(
    `DROP TRIGGER IF EXISTS "slice0_fail_photo_import_event_trigger" ON "GalleryEvent"`
  );
  await db.$executeRawUnsafe(
    `DROP FUNCTION IF EXISTS "slice0_fail_photo_import_event"()`
  );
}

afterAll(async () => {
  await removePhotoFailureTrigger();
  await removeEventFailureTrigger();
  await db.client.deleteMany({ where: { id: { in: clientIds } } });
  await db.$disconnect();
  await fs.rm(storageRoot, { recursive: true, force: true });
});

describe("atomic photo import with PostgreSQL", () => {
  it("persists photos and an actor-aware event with accurate counters", async () => {
    const { gallery } = await createGallery(["01.jpg", "02.jpg"]);

    const result = await importGalleryPhotos(gallery.id, {
      actorType: "ADMIN",
      actorId: "admin-1",
    });

    const photos = await db.photo.findMany({
      where: { galleryId: gallery.id },
      orderBy: { sortOrder: "asc" },
    });
    const events = await db.galleryEvent.findMany({
      where: { galleryId: gallery.id, type: "PHOTOS_IMPORTED" },
    });

    expect(result).toEqual({
      importedCount: 2,
      updatedCount: 0,
      skippedCount: 0,
      totalProcessed: 2,
    });
    expect(photos.map((photo) => photo.baseName)).toEqual(["01", "02"]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      actorType: "ADMIN",
      actorId: "admin-1",
      metadata: {
        source: "local_filesystem",
        importedCount: 2,
        updatedCount: 0,
        skippedCount: 0,
        totalProcessed: 2,
      },
    });
    expect(JSON.stringify(events[0].metadata)).not.toContain(storageRoot);
  });

  it("returns zero counters without creating an event for an empty folder", async () => {
    const { gallery } = await createGallery([]);

    await expect(
      importGalleryPhotos(gallery.id, { actorType: "SYSTEM" })
    ).resolves.toEqual({
      importedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      totalProcessed: 0,
    });

    expect(await db.photo.count({ where: { galleryId: gallery.id } })).toBe(0);
    expect(await db.galleryEvent.count({ where: { galleryId: gallery.id } })).toBe(0);
  });

  it("rejects an archived gallery without persisting photos or events", async () => {
    const { gallery } = await createGallery(["01.jpg"]);
    await db.gallery.update({
      where: { id: gallery.id },
      data: { status: GalleryStatus.ARCHIVED },
    });

    await expect(
      importGalleryPhotos(gallery.id, { actorType: "SYSTEM" })
    ).rejects.toBeInstanceOf(GalleryUnavailableError);

    expect(await db.photo.count({ where: { galleryId: gallery.id } })).toBe(0);
    expect(await db.galleryEvent.count({ where: { galleryId: gallery.id } })).toBe(0);
  });

  it("is idempotent and updates permitted metadata without duplicating a photo", async () => {
    const { gallery, absoluteFolder } = await createGallery(["01.jpg"]);

    await importGalleryPhotos(gallery.id, { actorType: "SYSTEM" });
    await expect(
      importGalleryPhotos(gallery.id, { actorType: "SYSTEM" })
    ).resolves.toEqual({
      importedCount: 0,
      updatedCount: 0,
      skippedCount: 1,
      totalProcessed: 1,
    });
    expect(
      await db.galleryEvent.count({
        where: { galleryId: gallery.id, type: "PHOTOS_IMPORTED" },
      })
    ).toBe(1);

    await fs.rm(path.join(absoluteFolder, "01.jpg"));
    await fs.writeFile(path.join(absoluteFolder, "01.webp"), "updated test image");

    await expect(
      importGalleryPhotos(gallery.id, { actorType: "SYSTEM" })
    ).resolves.toEqual({
      importedCount: 0,
      updatedCount: 1,
      skippedCount: 0,
      totalProcessed: 1,
    });

    const photos = await db.photo.findMany({ where: { galleryId: gallery.id } });
    expect(photos).toHaveLength(1);
    expect(photos[0]).toMatchObject({
      baseName: "01",
      filename: "01.webp",
      thumbPath: expect.stringMatching(/01\.webp$/),
    });
  });

  it("rejects traversal and invalid files before persisting", async () => {
    const traversal = await createGallery([], "../outside");
    const invalid = await createGallery(["01.jpg", "notes.txt"]);

    await expect(
      importGalleryPhotos(traversal.gallery.id, { actorType: "SYSTEM" })
    ).rejects.toBeInstanceOf(PhotoImportValidationError);
    await expect(
      importGalleryPhotos(invalid.gallery.id, { actorType: "SYSTEM" })
    ).rejects.toBeInstanceOf(PhotoImportValidationError);

    expect(
      await db.photo.count({
        where: { galleryId: { in: [traversal.gallery.id, invalid.gallery.id] } },
      })
    ).toBe(0);
    expect(
      await db.galleryEvent.count({
        where: { galleryId: { in: [traversal.gallery.id, invalid.gallery.id] } },
      })
    ).toBe(0);
  });

  it("rolls back the first photo when the second upsert fails", async () => {
    const { gallery } = await createGallery(["01-ok.jpg", "02-fail.jpg"]);
    await installPhotoFailureTrigger();

    try {
      await expect(
        importGalleryPhotos(gallery.id, { actorType: "SYSTEM" })
      ).rejects.toThrow("forced second photo upsert failure");
    } finally {
      await removePhotoFailureTrigger();
    }

    expect(await db.photo.count({ where: { galleryId: gallery.id } })).toBe(0);
    expect(await db.galleryEvent.count({ where: { galleryId: gallery.id } })).toBe(0);
  });

  it("rolls back every upsert when event creation fails", async () => {
    const { gallery } = await createGallery(["01.jpg", "02.jpg"]);
    await installEventFailureTrigger();

    try {
      await expect(
        importGalleryPhotos(gallery.id, {
          actorType: "ADMIN",
          actorId: "fail-event",
        })
      ).rejects.toThrow("forced photo import event failure");
    } finally {
      await removeEventFailureTrigger();
    }

    expect(await db.photo.count({ where: { galleryId: gallery.id } })).toBe(0);
    expect(await db.galleryEvent.count({ where: { galleryId: gallery.id } })).toBe(0);
  });
});
