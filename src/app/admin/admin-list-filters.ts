import { GalleryStatus } from "@prisma/client";

export function filterClients<
  T extends { email: string | null; galleries: unknown[]; name: string; phone: string | null }
>(clients: T[], q: string, gallery: string) {
  const normalizedQuery = q.trim().toLocaleLowerCase("es");
  return clients.filter((client) => {
    const matchesQuery = !normalizedQuery || [client.name, client.email, client.phone]
      .some((value) => value?.toLocaleLowerCase("es").includes(normalizedQuery));
    const matchesGallery = gallery === "with" ? client.galleries.length > 0 : gallery === "without" ? client.galleries.length === 0 : true;
    return matchesQuery && matchesGallery;
  });
}

export function filterGalleries<
  T extends { client: { name: string }; status: GalleryStatus; title: string }
>(galleries: T[], q: string, status: string) {
  const normalizedQuery = q.trim().toLocaleLowerCase("es");
  return galleries.filter((gallery) => {
    const matchesQuery = !normalizedQuery || [gallery.title, gallery.client.name]
      .some((value) => value.toLocaleLowerCase("es").includes(normalizedQuery));
    const matchesStatus = status === "closed"
      ? ([GalleryStatus.DELIVERED, GalleryStatus.ARCHIVED] as GalleryStatus[]).includes(gallery.status)
      : Object.values(GalleryStatus).includes(status as GalleryStatus) ? gallery.status === status : true;
    return matchesQuery && matchesStatus;
  });
}
