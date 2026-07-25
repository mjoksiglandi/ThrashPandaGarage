import { GalleryStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GalleryUnavailableError } from "@/modules/galleries/gallery.errors";

const mocks = vi.hoisted(() => ({
  updateSelectionFromClient: vi.fn(),
}));

vi.mock("@/modules/selections/selection.service", () => ({
  updateSelectionFromClient: mocks.updateSelectionFromClient,
}));

import { POST } from "./route";

const context = { params: Promise.resolve({ token: "token-1" }) };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST gallery selection", () => {
  it("returns 400 for malformed JSON without calling the service", async () => {
    const request = new NextRequest("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    });

    const response = await POST(request, context);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Invalid JSON payload",
    });
    expect(mocks.updateSelectionFromClient).not.toHaveBeenCalled();
  });

  it("passes the parsed payload to the canonical service", async () => {
    const payload = {
      photoId: "photo-1",
      selected: true,
      status: GalleryStatus.ARCHIVED,
      actorId: "forged-actor",
    };
    const request = new NextRequest("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const response = await POST(request, context);

    expect(response.status).toBe(200);
    expect(mocks.updateSelectionFromClient).toHaveBeenCalledWith(
      "token-1",
      payload
    );
  });

  it("maps an unavailable gallery to 410", async () => {
    mocks.updateSelectionFromClient.mockRejectedValueOnce(
      new GalleryUnavailableError()
    );
    const request = new NextRequest("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId: "photo-1", selected: true }),
    });

    const response = await POST(request, context);

    expect(response.status).toBe(410);
  });
});
