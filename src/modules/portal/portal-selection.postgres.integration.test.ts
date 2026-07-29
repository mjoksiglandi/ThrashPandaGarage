import { AccountStatus, GalleryStatus, PhotoStatus } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { clientRepository } from "@/modules/clients/client.repository";
import { galleryRepository } from "@/modules/galleries/gallery.repository";
import { photoRepository } from "@/modules/photos/photo.repository";
import { updateSelectionFromClient } from "@/modules/selections/selection.service";
import { createAccountClientAccessService } from "./account-client-access.service";
import { createPortalGalleryPhotosService } from "./portal-gallery-photos.service";
import { setPortalPhotoSelection } from "./portal-selection.service";

const runId = `portal_selection_${Date.now()}`;
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
    selectionLimit?: number | null;
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
      selectionLimit: overrides.selectionLimit ?? null,
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
const portalPhotos = createPortalGalleryPhotosService({ photos: photoRepository });

/**
 * Mirrors authorizePortalPhotoInGallery's gate without depending on next/headers'
 * request-scoped cookies(), which is unavailable outside an actual request.
 */
async function authorizeForTest(
  principal: {
    sessionId: string;
    accountId: string;
    clientId: string;
    email: string;
  },
  galleryId: string,
  photoId: string
) {
  const gallery = await access.findGallery(principal, galleryId);
  if (!gallery) return null;

  const photo = await photoRepository.find(photoId);
  if (!photo || photo.status === "REJECTED" || photo.galleryId !== gallery.id) {
    return null;
  }

  return { gallery, photo };
}

afterAll(async () => {
  await db.client.deleteMany({ where: { id: { in: clientIds } } });
  await db.$disconnect();
});

describe("Authenticated portal photo selection isolation with PostgreSQL", () => {
  it("lets account A select a photo in a gallery it is authorized for", async () => {
    const owner = await createAccountClient("iso-select");
    const gallery = await createGallery(owner.client.id, "iso-select-1");
    const photo = await createPhoto(gallery.id, "iso-select-1-photo");

    const authorized = await authorizeForTest(owner.principal, gallery.id, photo.id);
    expect(authorized).not.toBeNull();

    const result = await setPortalPhotoSelection(gallery.id, photo.id, true);

    expect(result.selected).toBe(true);
    const persisted = await db.selection.findUniqueOrThrow({ where: { photoId: photo.id } });
    expect(persisted).toMatchObject({ galleryId: gallery.id, selected: true });
  });

  it("does not let account A authorize a photo belonging to client B", async () => {
    const ownerA = await createAccountClient("iso-cross-client-a");
    const ownerB = await createAccountClient("iso-cross-client-b");
    const galleryB = await createGallery(ownerB.client.id, "iso-cross-client-b1");
    const photoB = await createPhoto(galleryB.id, "iso-cross-client-b1-photo");

    const authorized = await authorizeForTest(ownerA.principal, galleryB.id, photoB.id);

    expect(authorized).toBeNull();
    expect(await db.selection.findUnique({ where: { photoId: photoB.id } })).toBeNull();
  });

  it("does not let account A mutate a photo from a different gallery of its own client via an arbitrary photoId", async () => {
    const owner = await createAccountClient("iso-cross-gallery");
    const galleryA1 = await createGallery(owner.client.id, "iso-cross-gallery-1");
    const galleryA2 = await createGallery(owner.client.id, "iso-cross-gallery-2");
    const photoInOtherGallery = await createPhoto(galleryA2.id, "iso-cross-gallery-2-photo");

    const authorized = await authorizeForTest(
      owner.principal,
      galleryA1.id,
      photoInOtherGallery.id
    );

    expect(authorized).toBeNull();
    expect(
      await db.selection.findUnique({ where: { photoId: photoInOtherGallery.id } })
    ).toBeNull();
  });

  it("produces the same homogeneous null outcome for a nonexistent photo and a foreign photo", async () => {
    const ownerA = await createAccountClient("iso-homogeneous-a");
    const ownerB = await createAccountClient("iso-homogeneous-b");
    const galleryA = await createGallery(ownerA.client.id, "iso-homogeneous-a1");
    const galleryB = await createGallery(ownerB.client.id, "iso-homogeneous-b1");
    const foreignPhoto = await createPhoto(galleryB.id, "iso-homogeneous-b1-photo");

    const missing = await authorizeForTest(ownerA.principal, galleryA.id, "does-not-exist");
    const foreign = await authorizeForTest(ownerA.principal, galleryA.id, foreignPhoto.id);

    expect(missing).toBeNull();
    expect(foreign).toBeNull();
  });

  it("does not authorize selection on an archived gallery", async () => {
    const owner = await createAccountClient("iso-archived");
    const gallery = await createGallery(owner.client.id, "iso-archived-1", {
      status: GalleryStatus.ARCHIVED,
    });
    const photo = await createPhoto(gallery.id, "iso-archived-1-photo");

    const authorized = await authorizeForTest(owner.principal, gallery.id, photo.id);

    expect(authorized).toBeNull();
  });

  it("does not authorize selection on an expired gallery", async () => {
    const owner = await createAccountClient("iso-expired");
    const gallery = await createGallery(owner.client.id, "iso-expired-1", {
      expiresAt: new Date(now.getTime() - 1000),
    });
    const photo = await createPhoto(gallery.id, "iso-expired-1-photo");

    const authorized = await authorizeForTest(owner.principal, gallery.id, photo.id);

    expect(authorized).toBeNull();
  });

  it("does not authorize selection on a rejected photo", async () => {
    const owner = await createAccountClient("iso-rejected");
    const gallery = await createGallery(owner.client.id, "iso-rejected-1");
    const photo = await createPhoto(gallery.id, "iso-rejected-1-photo", {
      status: PhotoStatus.REJECTED,
    });

    const authorized = await authorizeForTest(owner.principal, gallery.id, photo.id);

    expect(authorized).toBeNull();
  });
});

describe("Single shared selection state across the public and portal contracts", () => {
  it("makes a portal selection immediately visible through the public token contract", async () => {
    const owner = await createAccountClient("shared-portal-to-public");
    const gallery = await createGallery(owner.client.id, "shared-portal-to-public-1");
    const photo = await createPhoto(gallery.id, "shared-portal-to-public-1-photo");

    await setPortalPhotoSelection(gallery.id, photo.id, true);

    const viaToken = await galleryRepository.findByToken(gallery.accessToken);
    const selectionViaToken = viaToken?.photos.find((item) => item.id === photo.id)?.selection;
    expect(selectionViaToken).toMatchObject({ selected: true });
  });

  it("makes a public selection immediately visible through the portal contract", async () => {
    const owner = await createAccountClient("shared-public-to-portal");
    const gallery = await createGallery(owner.client.id, "shared-public-to-portal-1");
    const photo = await createPhoto(gallery.id, "shared-public-to-portal-1-photo");

    await updateSelectionFromClient(gallery.accessToken, { photoId: photo.id, selected: true });

    const viaPortal = await portalPhotos.listForGallery(gallery.id);
    expect(viaPortal.find((item) => item.id === photo.id)).toMatchObject({ selected: true });
  });

  it("makes a public deselection immediately visible through the portal contract", async () => {
    const owner = await createAccountClient("shared-public-deselect");
    const gallery = await createGallery(owner.client.id, "shared-public-deselect-1");
    const photo = await createPhoto(gallery.id, "shared-public-deselect-1-photo");
    await setPortalPhotoSelection(gallery.id, photo.id, true);

    await updateSelectionFromClient(gallery.accessToken, { photoId: photo.id, selected: false });

    const viaPortal = await portalPhotos.listForGallery(gallery.id);
    expect(viaPortal.find((item) => item.id === photo.id)).toMatchObject({ selected: false });
  });

  it("makes a portal deselection immediately visible through the public token contract", async () => {
    const owner = await createAccountClient("shared-portal-deselect");
    const gallery = await createGallery(owner.client.id, "shared-portal-deselect-1");
    const photo = await createPhoto(gallery.id, "shared-portal-deselect-1-photo");
    await updateSelectionFromClient(gallery.accessToken, { photoId: photo.id, selected: true });

    await setPortalPhotoSelection(gallery.id, photo.id, false);

    const viaToken = await galleryRepository.findByToken(gallery.accessToken);
    const selectionViaToken = viaToken?.photos.find((item) => item.id === photo.id)?.selection;
    expect(selectionViaToken).toMatchObject({ selected: false });
  });

  it("never creates duplicate or parallel selection rows across repeated cross-flow mutations", async () => {
    const owner = await createAccountClient("shared-no-duplicates");
    const gallery = await createGallery(owner.client.id, "shared-no-duplicates-1");
    const photo = await createPhoto(gallery.id, "shared-no-duplicates-1-photo");

    await setPortalPhotoSelection(gallery.id, photo.id, true);
    await updateSelectionFromClient(gallery.accessToken, { photoId: photo.id, selected: false });
    await setPortalPhotoSelection(gallery.id, photo.id, true);
    await updateSelectionFromClient(gallery.accessToken, { photoId: photo.id, selected: true });

    const rows = await db.selection.findMany({ where: { photoId: photo.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].selected).toBe(true);
  });
});

describe("Selection concurrency across the public and portal contracts", () => {
  it("leaves the photo selected after two simultaneous portal selections", async () => {
    const owner = await createAccountClient("concurrency-double-select");
    const gallery = await createGallery(owner.client.id, "concurrency-double-select-1");
    const photo = await createPhoto(gallery.id, "concurrency-double-select-1-photo");

    const results = await Promise.allSettled([
      setPortalPhotoSelection(gallery.id, photo.id, true),
      setPortalPhotoSelection(gallery.id, photo.id, true),
    ]);

    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    const persisted = await db.selection.findUniqueOrThrow({ where: { photoId: photo.id } });
    expect(persisted.selected).toBe(true);
    expect(await db.selection.count({ where: { photoId: photo.id } })).toBe(1);
  });

  it("leaves the photo deselected after two simultaneous portal deselections", async () => {
    const owner = await createAccountClient("concurrency-double-deselect");
    const gallery = await createGallery(owner.client.id, "concurrency-double-deselect-1");
    const photo = await createPhoto(gallery.id, "concurrency-double-deselect-1-photo");
    await setPortalPhotoSelection(gallery.id, photo.id, true);

    const results = await Promise.allSettled([
      setPortalPhotoSelection(gallery.id, photo.id, false),
      setPortalPhotoSelection(gallery.id, photo.id, false),
    ]);

    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    const persisted = await db.selection.findUniqueOrThrow({ where: { photoId: photo.id } });
    expect(persisted.selected).toBe(false);
    expect(await db.selection.count({ where: { photoId: photo.id } })).toBe(1);
  });

  it("does not corrupt state when the public and portal contracts select the same photo simultaneously", async () => {
    const owner = await createAccountClient("concurrency-public-portal-select");
    const gallery = await createGallery(owner.client.id, "concurrency-public-portal-select-1");
    const photo = await createPhoto(gallery.id, "concurrency-public-portal-select-1-photo");

    const results = await Promise.allSettled([
      setPortalPhotoSelection(gallery.id, photo.id, true),
      updateSelectionFromClient(gallery.accessToken, { photoId: photo.id, selected: true }),
    ]);

    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    expect(await db.selection.count({ where: { photoId: photo.id } })).toBe(1);
    const persisted = await db.selection.findUniqueOrThrow({ where: { photoId: photo.id } });
    expect(persisted.selected).toBe(true);
  });

  it("settles opposing concurrent public and portal mutations into a single valid final state", async () => {
    const owner = await createAccountClient("concurrency-opposite");
    const gallery = await createGallery(owner.client.id, "concurrency-opposite-1");
    const photo = await createPhoto(gallery.id, "concurrency-opposite-1-photo");
    await setPortalPhotoSelection(gallery.id, photo.id, true);

    const results = await Promise.allSettled([
      setPortalPhotoSelection(gallery.id, photo.id, false),
      updateSelectionFromClient(gallery.accessToken, { photoId: photo.id, selected: true }),
    ]);

    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    expect(await db.selection.count({ where: { photoId: photo.id } })).toBe(1);
    const persisted = await db.selection.findUniqueOrThrow({ where: { photoId: photo.id } });
    expect(typeof persisted.selected).toBe("boolean");

    const viaPortal = await portalPhotos.listForGallery(gallery.id);
    const viaToken = await galleryRepository.findByToken(gallery.accessToken);
    const selectionViaToken = viaToken?.photos.find((item) => item.id === photo.id)?.selection;
    expect(viaPortal.find((item) => item.id === photo.id)?.selected).toBe(persisted.selected);
    expect(selectionViaToken?.selected).toBe(persisted.selected);
  });

  it("repeats the double-selection race across independent iterations without drift", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const owner = await createAccountClient(`concurrency-repeat-${attempt}`);
      const gallery = await createGallery(owner.client.id, `concurrency-repeat-${attempt}-1`);
      const photo = await createPhoto(gallery.id, `concurrency-repeat-${attempt}-1-photo`);

      const results = await Promise.allSettled([
        setPortalPhotoSelection(gallery.id, photo.id, true),
        setPortalPhotoSelection(gallery.id, photo.id, true),
        setPortalPhotoSelection(gallery.id, photo.id, true),
      ]);

      expect(results.every((result) => result.status === "fulfilled")).toBe(true);
      expect(await db.selection.count({ where: { photoId: photo.id } })).toBe(1);
      const persisted = await db.selection.findUniqueOrThrow({ where: { photoId: photo.id } });
      expect(persisted.selected).toBe(true);
    }
  });

  it("serializes concurrent portal selections against a selectionLimit of one", async () => {
    const owner = await createAccountClient("concurrency-limit");
    const gallery = await createGallery(owner.client.id, "concurrency-limit-1", {
      selectionLimit: 1,
    });
    const photoA = await createPhoto(gallery.id, "concurrency-limit-1-a");
    const photoB = await createPhoto(gallery.id, "concurrency-limit-1-b");

    const results = await Promise.allSettled([
      setPortalPhotoSelection(gallery.id, photoA.id, true),
      setPortalPhotoSelection(gallery.id, photoB.id, true),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(
      await db.selection.count({ where: { galleryId: gallery.id, selected: true } })
    ).toBe(1);
  });
});
