import { GalleryStatus } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import {
  GalleryUnavailableError,
  SelectionClosedError,
  SelectionCountMismatchError,
} from "@/modules/galleries/gallery.errors";
import {
  transitionGallery,
  updateGalleryFromForm,
} from "@/modules/galleries/gallery.service";
import { confirmSelection, updateSelectionFromClient } from "./selection.service";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const runId = `slice0_${Date.now()}`;
let sequence = 0;
const clientIds: string[] = [];

async function createProofingGallery({
  selectionLimit = 1,
  photoCount = 1,
  selectedIndexes = [0],
}: {
  selectionLimit?: number | null;
  photoCount?: number;
  selectedIndexes?: number[];
} = {}) {
  sequence += 1;
  const client = await db.client.create({
    data: { name: `${runId}_${sequence}` },
  });
  clientIds.push(client.id);

  const gallery = await db.gallery.create({
    data: {
      clientId: client.id,
      title: `${runId}_${sequence}`,
      slug: `${runId}-${sequence}`,
      accessToken: `${runId}_${sequence}`,
      status: GalleryStatus.PROOFING,
      selectionLimit,
      photos: {
        create: Array.from({ length: photoCount }, (_, index) => ({
          filename: `proof-${index + 1}.jpg`,
          baseName: `proof-${index + 1}`,
          thumbPath: `proof-${index + 1}.jpg`,
          sortOrder: index,
        })),
      },
    },
    include: { photos: true },
  });

  if (selectedIndexes.length > 0) {
    await db.selection.createMany({
      data: selectedIndexes.map((index) => ({
        galleryId: gallery.id,
        photoId: gallery.photos[index].id,
        selected: true,
      })),
    });
  }

  return { gallery, photos: gallery.photos };
}

function galleryForm(
  gallery: Awaited<ReturnType<typeof createProofingGallery>>["gallery"],
  expiresAt: Date
) {
  const formData = new FormData();
  formData.set("clientId", gallery.clientId);
  formData.set("title", gallery.title);
  formData.set("slug", gallery.slug);
  formData.set(
    "selectionLimit",
    gallery.selectionLimit === null ? "" : String(gallery.selectionLimit)
  );
  formData.set("expiresAt", expiresAt.toISOString());
  return formData;
}

beforeEach(async () => {
  await db.galleryEvent.deleteMany({
    where: { gallery: { clientId: { in: clientIds } } },
  });
});

afterAll(async () => {
  await db.client.deleteMany({ where: { id: { in: clientIds } } });
  await db.$disconnect();
});

describe("selection concurrency with PostgreSQL row locks", () => {
  it("makes a double confirmation idempotent and emits one event", async () => {
    const { gallery } = await createProofingGallery();

    const [a, b] = await Promise.all([
      confirmSelection(gallery.accessToken),
      confirmSelection(gallery.accessToken),
    ]);

    expect([a.status, b.status].sort()).toEqual(["already_confirmed", "confirmed"]);
    expect(a.confirmedAt.getTime()).toBe(b.confirmedAt.getTime());
    expect(
      await db.galleryEvent.count({
        where: { galleryId: gallery.id, type: "SELECTION_CONFIRMED" },
      })
    ).toBe(1);
  });

  it("never persists a mutation after confirmation", async () => {
    const { gallery, photos } = await createProofingGallery();
    const photo = photos[0];

    const mutation = updateSelectionFromClient(gallery.accessToken, {
      photoId: photo.id,
      selected: true,
      comment: "concurrent mutation",
    });
    const confirmation = confirmSelection(gallery.accessToken);
    const [mutationResult, confirmationResult] = await Promise.allSettled([mutation, confirmation]);

    expect(confirmationResult.status).toBe("fulfilled");
    if (mutationResult.status === "rejected") {
      expect(mutationResult.reason).toBeInstanceOf(SelectionClosedError);
    }

    await expect(
      updateSelectionFromClient(gallery.accessToken, {
        photoId: photo.id,
        selected: true,
        comment: "must not persist",
      })
    ).rejects.toBeInstanceOf(SelectionClosedError);

    const persisted = await db.selection.findUniqueOrThrow({ where: { photoId: photo.id } });
    expect(persisted.comment).not.toBe("must not persist");
    expect(
      await db.gallery.findUniqueOrThrow({ where: { id: gallery.id } })
    ).toMatchObject({ status: GalleryStatus.SELECTION_CONFIRMED });
  });

  it("serializes two selections so they cannot exceed selectionLimit", async () => {
    const { gallery, photos } = await createProofingGallery({
      photoCount: 2,
      selectedIndexes: [],
    });

    const results = await Promise.allSettled(
      photos.map((photo) =>
        updateSelectionFromClient(gallery.accessToken, {
          photoId: photo.id,
          selected: true,
        })
      )
    );

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      reason: expect.any(SelectionCountMismatchError),
    });
    expect(
      await db.selection.count({
        where: { galleryId: gallery.id, selected: true },
      })
    ).toBe(1);
  });

  it("revalidates persisted status during confirmation racing archive", async () => {
    const { gallery } = await createProofingGallery();

    const [confirmation, archive] = await Promise.allSettled([
      confirmSelection(gallery.accessToken),
      transitionGallery(gallery.id, GalleryStatus.ARCHIVED, {
        actorId: "admin-status-race",
      }),
    ]);

    expect(archive.status).toBe("fulfilled");
    expect(
      await db.gallery.findUniqueOrThrow({ where: { id: gallery.id } })
    ).toMatchObject({ status: GalleryStatus.ARCHIVED });

    if (confirmation.status === "rejected") {
      expect(confirmation.reason).toBeInstanceOf(GalleryUnavailableError);
    }
    expect(
      await db.galleryEvent.count({
        where: { galleryId: gallery.id, type: "SELECTION_CONFIRMED" },
      })
    ).toBe(confirmation.status === "fulfilled" ? 1 : 0);
    expect(
      await db.galleryEvent.count({
        where: { galleryId: gallery.id, type: "GALLERY_TRANSITIONED" },
      })
    ).toBe(1);
  });

  it("revalidates persisted expiresAt during confirmation", async () => {
    const { gallery } = await createProofingGallery();
    const expiredAt = new Date("2020-01-01T00:00:00.000Z");

    const [confirmation, expiryUpdate] = await Promise.allSettled([
      confirmSelection(gallery.accessToken),
      updateGalleryFromForm(
        gallery.id,
        galleryForm(gallery, expiredAt),
        { actorId: "admin-expiry-race" }
      ),
    ]);

    expect(expiryUpdate.status).toBe("fulfilled");
    const persisted = await db.gallery.findUniqueOrThrow({
      where: { id: gallery.id },
    });
    expect(persisted.expiresAt?.getTime()).toBe(expiredAt.getTime());
    if (confirmation.status === "rejected") {
      expect(confirmation.reason).toBeInstanceOf(GalleryUnavailableError);
      expect(persisted.status).toBe(GalleryStatus.PROOFING);
    } else {
      expect(persisted.status).toBe(GalleryStatus.SELECTION_CONFIRMED);
    }
    expect(
      await db.galleryEvent.count({
        where: { galleryId: gallery.id, type: "SELECTION_CONFIRMED" },
      })
    ).toBe(confirmation.status === "fulfilled" ? 1 : 0);
  });

  it("returns an explicit retry after a committed confirmation", async () => {
    const { gallery } = await createProofingGallery();

    const confirmed = await confirmSelection(gallery.accessToken);
    const retry = await confirmSelection(gallery.accessToken);

    expect(confirmed.status).toBe("confirmed");
    expect(retry.status).toBe("already_confirmed");
    expect(retry.confirmedAt.getTime()).toBe(confirmed.confirmedAt.getTime());
    expect(
      await db.galleryEvent.count({
        where: { galleryId: gallery.id, type: "SELECTION_CONFIRMED" },
      })
    ).toBe(1);
  });

  it("keeps confirmation and concurrent deselection mutually consistent", async () => {
    const { gallery, photos } = await createProofingGallery();

    const [deselection, confirmation] = await Promise.allSettled([
      updateSelectionFromClient(gallery.accessToken, {
        photoId: photos[0].id,
        selected: false,
      }),
      confirmSelection(gallery.accessToken),
    ]);

    const persistedGallery = await db.gallery.findUniqueOrThrow({
      where: { id: gallery.id },
    });
    const persistedSelection = await db.selection.findUniqueOrThrow({
      where: { photoId: photos[0].id },
    });

    if (confirmation.status === "fulfilled") {
      expect(deselection).toMatchObject({
        status: "rejected",
        reason: expect.any(SelectionClosedError),
      });
      expect(persistedGallery.status).toBe(GalleryStatus.SELECTION_CONFIRMED);
      expect(persistedSelection.selected).toBe(true);
    } else {
      expect(confirmation.reason).toBeInstanceOf(SelectionCountMismatchError);
      expect(deselection.status).toBe("fulfilled");
      expect(persistedGallery.status).toBe(GalleryStatus.PROOFING);
      expect(persistedSelection.selected).toBe(false);
    }

    expect(
      await db.galleryEvent.count({
        where: { galleryId: gallery.id, type: "SELECTION_CONFIRMED" },
      })
    ).toBe(confirmation.status === "fulfilled" ? 1 : 0);
  });
});
