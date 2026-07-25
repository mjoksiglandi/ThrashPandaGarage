import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GalleryNotFoundError,
  SelectionCountMismatchError,
} from "@/modules/galleries/gallery.errors";

const mocks = vi.hoisted(() => ({
  confirmSelection: vi.fn(),
}));

vi.mock("@/modules/selections/selection.service", () => ({
  confirmSelection: mocks.confirmSelection,
}));

import { POST } from "./route";

const context = { params: Promise.resolve({ token: "token-1" }) };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST gallery confirmation", () => {
  it.each(["confirmed", "already_confirmed"] as const)(
    "returns 200 for %s",
    async (status) => {
      const confirmedAt = new Date("2026-07-24T01:00:00.000Z");
      mocks.confirmSelection.mockResolvedValueOnce({
        galleryId: "gallery-1",
        status,
        selectedCount: 2,
        confirmedAt,
      });

      const response = await POST(new Request("http://localhost"), context);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        ok: true,
        status,
        selectedCount: 2,
        confirmedAt: confirmedAt.toISOString(),
      });
    }
  );

  it("maps a missing gallery to 404", async () => {
    mocks.confirmSelection.mockRejectedValueOnce(new GalleryNotFoundError());

    const response = await POST(new Request("http://localhost"), context);

    expect(response.status).toBe(404);
  });

  it("maps a count conflict to 409", async () => {
    mocks.confirmSelection.mockRejectedValueOnce(
      new SelectionCountMismatchError()
    );

    const response = await POST(new Request("http://localhost"), context);

    expect(response.status).toBe(409);
  });

  it("does not expose unexpected internal details", async () => {
    mocks.confirmSelection.mockRejectedValueOnce(
      new Error("Prisma internal detail")
    );

    const response = await POST(new Request("http://localhost"), context);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Unexpected error",
    });
  });
});
