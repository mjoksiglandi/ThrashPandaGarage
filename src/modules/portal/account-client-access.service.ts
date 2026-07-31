import type { GalleryStatus } from "@prisma/client";
import type { AccountSessionPrincipal } from "@/modules/account-sessions/current-account-session.service";
import { isSelectionOpen } from "@/modules/galleries/gallery-workflow";

type PortalClient = {
  id: string;
  name: string;
};

type PortalGallery = {
  id: string;
  title: string;
  status: GalleryStatus;
  createdAt: Date;
  expiresAt: Date | null;
  deliveryDriveUrl: string | null;
};

type AccountClientAccessDependencies = {
  clients: {
    findLinkedToAccount(
      accountId: string,
      clientId: string
    ): Promise<PortalClient | null>;
  };
  galleries: {
    listAvailableForClient(
      clientId: string,
      now: Date
    ): Promise<PortalGallery[]>;
    findAvailableForClient(
      id: string,
      clientId: string,
      now: Date
    ): Promise<PortalGallery | null>;
  };
  clock: {
    now(): Date;
  };
};

export function createAccountClientAccessService(
  dependencies: AccountClientAccessDependencies
) {
  async function linkedClient(principal: AccountSessionPrincipal) {
    return dependencies.clients.findLinkedToAccount(
      principal.accountId,
      principal.clientId
    );
  }

  return {
    async listGalleries(principal: AccountSessionPrincipal) {
      const client = await linkedClient(principal);
      if (!client) {
        return null;
      }

      const galleries =
        await dependencies.galleries.listAvailableForClient(
          principal.clientId,
          dependencies.clock.now()
        );
      return { client, galleries };
    },

    async findGallery(
      principal: AccountSessionPrincipal,
      galleryId: string
    ) {
      if (!(await linkedClient(principal))) {
        return null;
      }

      const now = dependencies.clock.now();
      const gallery = await dependencies.galleries.findAvailableForClient(
        galleryId,
        principal.clientId,
        now
      );
      return gallery
        ? { ...gallery, selectionOpen: isSelectionOpen(gallery, now) }
        : null;
    },
  };
}
