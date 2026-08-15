import { GalleryStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { filterClients, filterGalleries } from "./admin-list-filters";

describe("admin list filters", () => {
  it("searches client fields and derives the gallery filter locally", () => {
    const clients = [
      { name: "Catalina R.", email: "cata@example.test", phone: null, galleries: [{}] },
      { name: "Estudio Vera", email: null, phone: "+56 9 1234", galleries: [] },
    ];

    expect(filterClients(clients, "CATA", "with")).toEqual([clients[0]]);
    expect(filterClients(clients, "1234", "without")).toEqual([clients[1]]);
  });

  it("searches gallery and client names and groups closed statuses", () => {
    const galleries = [
      { title: "After Hours", client: { name: "Catalina" }, status: GalleryStatus.PROOFING },
      { title: "Neon Alley", client: { name: "Estudio Vera" }, status: GalleryStatus.DELIVERED },
      { title: "Bosque", client: { name: "Catalina" }, status: GalleryStatus.ARCHIVED },
    ];

    expect(filterGalleries(galleries, "vera", "all")).toEqual([galleries[1]]);
    expect(filterGalleries(galleries, "", "closed")).toEqual([galleries[1], galleries[2]]);
    expect(filterGalleries(galleries, "after", GalleryStatus.PROOFING)).toEqual([galleries[0]]);
  });
});
