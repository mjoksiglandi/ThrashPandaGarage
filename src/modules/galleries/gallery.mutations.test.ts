import { GalleryStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    gallery: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    selection: {
      count: vi.fn(),
    },
    galleryEvent: {
      create: vi.fn(),
    },
  };
  return {
    tx,
    db: {
      $transaction: vi.fn(),
    },
    revalidatePath: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  createGalleryFromForm,
  transitionGallery,
  updateGalleryFromForm,
} from "./gallery.service";
import { InvalidGalleryTransitionError } from "./gallery.errors";

const gallery = {
  id: "gallery-1",
  clientId: "client-1",
  title: "Gallery",
  slug: "gallery",
  accessToken: "token",
  status: GalleryStatus.DRAFT,
  selectionLimit: null,
  expiresAt: null,
  proofingLocalPath: null,
  thumbnailLocalPath: null,
  previewLocalPath: null,
  googleDriveFolderUrl: null,
  deliveryDriveUrl: null,
  emailSentAt: null,
  selectionConfirmedAt: null,
  deliveredAt: null,
  createdAt: new Date("2026-07-24T00:00:00.000Z"),
  updatedAt: new Date("2026-07-24T00:00:00.000Z"),
};

function galleryForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const values = {
    clientId: gallery.clientId,
    title: gallery.title,
    slug: gallery.slug,
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.$transaction.mockImplementation(async (callback) => callback(mocks.tx));
  mocks.tx.$queryRaw.mockResolvedValue([{ id: gallery.id }]);
  mocks.tx.gallery.findUnique.mockResolvedValue(gallery);
  mocks.tx.gallery.create.mockImplementation(async ({ data }) => ({ ...gallery, ...data }));
  mocks.tx.gallery.update.mockImplementation(async ({ data }) => ({ ...gallery, ...data }));
  mocks.tx.selection.count.mockResolvedValue(0);
  mocks.tx.galleryEvent.create.mockResolvedValue({ id: "event-1" });
});

describe("gallery administrative mutations", () => {
  it("forces DRAFT when create input contains a manipulated status", async () => {
    const formData = galleryForm({ status: GalleryStatus.ARCHIVED });

    const created = await createGalleryFromForm(formData, { actorId: "admin-1" });

    expect(created.status).toBe(GalleryStatus.DRAFT);
    expect(mocks.tx.gallery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clientId: gallery.clientId,
        status: GalleryStatus.DRAFT,
      }),
    });
    expect(mocks.tx.galleryEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        galleryId: gallery.id,
        type: "GALLERY_CREATED",
        actorType: "ADMIN",
        actorId: "admin-1",
      }),
    });
    expect(mocks.db.$transaction).toHaveBeenCalledOnce();
  });

  it("does not update or emit an event when metadata has no effective changes", async () => {
    const result = await updateGalleryFromForm(gallery.id, galleryForm(), { actorId: "admin-1" });

    expect(result).toBe(gallery);
    expect(mocks.tx.$queryRaw).toHaveBeenCalledOnce();
    expect(mocks.tx.gallery.update).not.toHaveBeenCalled();
    expect(mocks.tx.galleryEvent.create).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("updates metadata and creates its event in the same transaction", async () => {
    await updateGalleryFromForm(
      gallery.id,
      galleryForm({ title: "Updated gallery" }),
      { actorId: "admin-1" }
    );

    expect(mocks.tx.gallery.update).toHaveBeenCalledWith({
      where: { id: gallery.id },
      data: expect.objectContaining({ title: "Updated gallery" }),
    });
    expect(mocks.tx.galleryEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        galleryId: gallery.id,
        type: "GALLERY_UPDATED",
        actorId: "admin-1",
        metadata: {
          status: GalleryStatus.DRAFT,
          changedFields: ["title"],
        },
      }),
    });
    expect(mocks.db.$transaction).toHaveBeenCalledOnce();
  });

  it("ignores injected status and audit fields on metadata updates", async () => {
    await updateGalleryFromForm(
      gallery.id,
      galleryForm({
        title: "Updated gallery",
        status: GalleryStatus.ARCHIVED,
        actorId: "forged-actor",
      }),
      { actorId: "admin-1" }
    );

    expect(mocks.tx.gallery.update).toHaveBeenCalledWith({
      where: { id: gallery.id },
      data: expect.not.objectContaining({
        status: expect.anything(),
        actorId: expect.anything(),
      }),
    });
    expect(mocks.tx.galleryEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ actorId: "admin-1" }),
    });
  });

  it("rejects a selection limit below the current selected count", async () => {
    mocks.tx.gallery.findUnique.mockResolvedValueOnce({
      ...gallery,
      selectionLimit: 3,
    });
    mocks.tx.selection.count.mockResolvedValueOnce(2);

    await expect(
      updateGalleryFromForm(
        gallery.id,
        galleryForm({ selectionLimit: "1" }),
        { actorId: "admin-1" }
      )
    ).rejects.toBeInstanceOf(InvalidGalleryTransitionError);

    expect(mocks.tx.selection.count).toHaveBeenCalledWith({
      where: { galleryId: gallery.id, selected: true },
    });
    expect(mocks.tx.gallery.update).not.toHaveBeenCalled();
    expect(mocks.tx.galleryEvent.create).not.toHaveBeenCalled();
  });

  it("allows a selection limit equal to the current selected count", async () => {
    mocks.tx.gallery.findUnique.mockResolvedValueOnce({
      ...gallery,
      selectionLimit: 3,
    });
    mocks.tx.selection.count.mockResolvedValueOnce(2);

    await updateGalleryFromForm(
      gallery.id,
      galleryForm({ selectionLimit: "2" }),
      { actorId: "admin-1" }
    );

    expect(mocks.tx.gallery.update).toHaveBeenCalledWith({
      where: { id: gallery.id },
      data: expect.objectContaining({ selectionLimit: 2 }),
    });
  });

  it("keeps the selection limit immutable after confirmation", async () => {
    mocks.tx.gallery.findUnique.mockResolvedValueOnce({
      ...gallery,
      selectionLimit: 2,
      selectionConfirmedAt: new Date("2026-07-24T01:00:00.000Z"),
    });

    await expect(
      updateGalleryFromForm(
        gallery.id,
        galleryForm({ selectionLimit: "3" }),
        { actorId: "admin-1" }
      )
    ).rejects.toBeInstanceOf(InvalidGalleryTransitionError);

    expect(mocks.tx.selection.count).not.toHaveBeenCalled();
    expect(mocks.tx.gallery.update).not.toHaveBeenCalled();
  });

  it("keeps the selection limit immutable in a confirmed status without a timestamp", async () => {
    mocks.tx.gallery.findUnique.mockResolvedValueOnce({
      ...gallery,
      status: GalleryStatus.SELECTION_CONFIRMED,
      selectionLimit: 2,
      selectionConfirmedAt: null,
    });

    await expect(
      updateGalleryFromForm(
        gallery.id,
        galleryForm({ selectionLimit: "3" }),
        { actorId: "admin-1" }
      )
    ).rejects.toBeInstanceOf(InvalidGalleryTransitionError);

    expect(mocks.tx.selection.count).not.toHaveBeenCalled();
    expect(mocks.tx.gallery.update).not.toHaveBeenCalled();
  });

  it("locks the gallery before validating and persisting a transition", async () => {
    await transitionGallery(gallery.id, GalleryStatus.PROOFING, { actorId: "admin-1" });

    expect(mocks.tx.$queryRaw).toHaveBeenCalledOnce();
    expect(mocks.tx.gallery.update).toHaveBeenCalledWith({
      where: { id: gallery.id },
      data: { status: GalleryStatus.PROOFING },
    });
    expect(mocks.tx.galleryEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        galleryId: gallery.id,
        type: "GALLERY_TRANSITIONED",
        actorId: "admin-1",
        metadata: {
          fromStatus: GalleryStatus.DRAFT,
          toStatus: GalleryStatus.PROOFING,
        },
      }),
    });
    expect(mocks.tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.tx.gallery.update.mock.invocationCallOrder[0]
    );
  });

  it("does not complete a create mutation when its audit event fails", async () => {
    mocks.tx.galleryEvent.create.mockRejectedValueOnce(new Error("event failure"));

    await expect(
      createGalleryFromForm(galleryForm(), { actorId: "admin-1" })
    ).rejects.toThrow("event failure");

    expect(mocks.db.$transaction).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
