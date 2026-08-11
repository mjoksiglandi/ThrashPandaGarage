import "server-only";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  ACCOUNT_SESSION_COOKIE_NAME,
  clearedAccountSessionCookie,
  clearedLegacyClientCookie,
} from "@/modules/account-sessions/account-session-cookie";
import {
  logoutAccountSessionToken,
  resolveAccountSessionToken,
} from "@/modules/account-sessions/current-account-session";
import { clientRepository } from "@/modules/clients/client.repository";
import { galleryRepository } from "@/modules/galleries/gallery.repository";
import { photoRepository } from "@/modules/photos/photo.repository";
import { createAccountClientAccessService } from "./account-client-access.service";
import { createPortalActorResolver } from "./portal-actor.service";
import { createPortalGalleryPhotosService } from "./portal-gallery-photos.service";

const portalActors = createPortalActorResolver({
  accountSessions: {
    resolve: resolveAccountSessionToken,
  },
});

const accountClientAccess = createAccountClientAccessService({
  clients: clientRepository,
  galleries: galleryRepository,
  clock: { now: () => new Date() },
});

const portalGalleryPhotos = createPortalGalleryPhotosService({
  photos: photoRepository,
});

export async function resolveCurrentPortalActor() {
  const cookieStore = await cookies();
  return portalActors.resolve(
    cookieStore.get(ACCOUNT_SESSION_COOKIE_NAME)?.value
  );
}

export async function requirePortalAccount() {
  const actor = await resolveCurrentPortalActor();
  if (actor.kind === "anonymous") {
    redirect("/login");
  }
  return actor;
}

export async function requirePortalClient() {
  const actor = await requirePortalAccount();

  const access = await accountClientAccess.listGalleries(actor);
  if (!access) {
    redirect("/login");
  }

  return { actor, ...access };
}

export async function requirePortalGallery(galleryId: string) {
  const actor = await resolveCurrentPortalActor();
  if (actor.kind === "anonymous") {
    redirect("/login");
  }

  const gallery = await accountClientAccess.findGallery(actor, galleryId);
  if (!gallery) {
    notFound();
  }

  return { actor, gallery };
}

export async function listPortalGalleryPhotos(galleryId: string) {
  return portalGalleryPhotos.listForGallery(galleryId);
}

export async function authorizePortalPhoto(photoId: string) {
  const actor = await resolveCurrentPortalActor();
  if (actor.kind === "anonymous") {
    return null;
  }

  const photo = await photoRepository.find(photoId);
  if (!photo || photo.status === "REJECTED") {
    return null;
  }

  const gallery = await accountClientAccess.findGallery(actor, photo.galleryId);
  if (!gallery) {
    return null;
  }

  return photo;
}

export async function authorizePortalPhotoInGallery(galleryId: string, photoId: string) {
  const authorized = await authorizePortalGallery(galleryId);
  if (!authorized) {
    return null;
  }

  const photo = await photoRepository.find(photoId);
  if (!photo || photo.status === "REJECTED" || photo.galleryId !== authorized.gallery.id) {
    return null;
  }

  return { ...authorized, photo };
}

export async function authorizePortalGallery(galleryId: string) {
  const actor = await resolveCurrentPortalActor();
  if (actor.kind === "anonymous") {
    return null;
  }

  const gallery = await accountClientAccess.findGallery(actor, galleryId);
  if (!gallery) {
    return null;
  }
  return { actor, gallery };
}

export async function logoutPortalActor() {
  const cookieStore = await cookies();
  const accountToken = cookieStore.get(
    ACCOUNT_SESSION_COOKIE_NAME
  )?.value;

  try {
    await logoutAccountSessionToken(accountToken);
  } finally {
    const cleared = clearedAccountSessionCookie();
    cookieStore.set(cleared.name, cleared.value, cleared.options);
    const legacyCookie = clearedLegacyClientCookie();
    cookieStore.set(
      legacyCookie.name,
      legacyCookie.value,
      legacyCookie.options
    );
  }
}
