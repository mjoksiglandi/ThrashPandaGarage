import type { GalleryEventActorType, GalleryStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { GalleryInput } from "./gallery.types";

export type DbClient = Prisma.TransactionClient | typeof db;

type GalleryEventInput = {
  galleryId: string;
  type: string;
  actorType?: GalleryEventActorType;
  actorId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

function availableForClient(
  clientId: string,
  now: Date
): Prisma.GalleryWhereInput {
  return {
    clientId,
    status: { not: "ARCHIVED" },
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
}

const portalGallerySelect = {
  id: true,
  title: true,
  status: true,
  createdAt: true,
  expiresAt: true,
  selectionLimit: true,
  selectionConfirmedAt: true,
  deliveryDriveUrl: true,
} satisfies Prisma.GallerySelect;

export const galleryRepository = {
  list() {
    return db.gallery.findMany({
      orderBy: { createdAt: "desc" },
      include: { client: true, photos: { select: { id: true } }, selections: true },
    });
  },
  find(id: string) {
    return db.gallery.findUnique({
      where: { id },
      include: {
        client: true,
        photos: { orderBy: { sortOrder: "asc" }, include: { selection: true } },
        selections: { include: { photo: true } },
        events: { orderBy: { createdAt: "desc" } },
      },
    });
  },
  listAvailableForClient(clientId: string, now: Date) {
    return db.gallery.findMany({
      where: availableForClient(clientId, now),
      orderBy: { createdAt: "desc" },
      select: portalGallerySelect,
    });
  },
  findAvailableForClient(id: string, clientId: string, now: Date) {
    return db.gallery.findFirst({
      where: {
        id,
        ...availableForClient(clientId, now),
      },
      select: portalGallerySelect,
    });
  },
  async findForUpdate(id: string, client: DbClient = db) {
    await client.$queryRaw`SELECT id FROM "Gallery" WHERE id = ${id} FOR UPDATE`;
    return client.gallery.findUnique({ where: { id } });
  },
  async findForInvitationForUpdate(id: string, client: DbClient = db) {
    await client.$queryRaw`SELECT id FROM "Gallery" WHERE id = ${id} FOR UPDATE`;
    return client.gallery.findUnique({ where: { id }, include: { client: true } });
  },
  async findByTokenForUpdate(accessToken: string, client: DbClient = db) {
    const gallery = await client.gallery.findUnique({ where: { accessToken }, select: { id: true } });
    if (!gallery) return null;
    return this.findForUpdate(gallery.id, client);
  },
  findByToken(accessToken: string) {
    return db.gallery.findUnique({
      where: { accessToken },
      include: {
        client: true,
        photos: { orderBy: { sortOrder: "asc" }, include: { selection: true } },
      },
    });
  },
  create(
    data: GalleryInput & { accessToken: string; status: GalleryStatus },
    client: DbClient = db
  ) {
    return client.gallery.create({ data });
  },
  update(id: string, data: Prisma.GalleryUncheckedUpdateInput, client: DbClient = db) {
    return client.gallery.update({ where: { id }, data });
  },
  event(
    inputOrGalleryId: GalleryEventInput | string,
    clientOrType: DbClient | string = db,
    maybeMetadata?: Prisma.InputJsonValue
  ) {
    const client = typeof inputOrGalleryId === "string" ? db : (clientOrType as DbClient);
    const input =
      typeof inputOrGalleryId === "string"
        ? { galleryId: inputOrGalleryId, type: clientOrType as string, metadata: maybeMetadata }
        : inputOrGalleryId;

    return client.galleryEvent.create({
      data: {
        galleryId: input.galleryId,
        type: input.type,
        actorType: input.actorType ?? "SYSTEM",
        actorId: input.actorId ?? null,
        metadata: input.metadata,
      },
    });
  },
};
