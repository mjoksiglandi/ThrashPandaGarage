import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateSelectionForGallery: vi.fn(),
  confirmSelectionForGallery: vi.fn(),
}));

vi.mock("@/modules/selections/selection.service", () => ({
  updateSelectionForGallery: mocks.updateSelectionForGallery,
  confirmSelectionForGallery: mocks.confirmSelectionForGallery,
}));

import {
  confirmPortalSelection,
  setPortalPhotoSelection,
} from "./portal-selection.service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateSelectionForGallery.mockResolvedValue({
    id: "selection-1",
    galleryId: "gallery-1",
    photoId: "photo-1",
    selected: true,
    comment: "Retocar",
  });
  mocks.confirmSelectionForGallery.mockResolvedValue({
    galleryId: "gallery-1",
    status: "confirmed",
    selectedCount: 1,
    confirmedAt: new Date("2030-01-01T00:00:00.000Z"),
  });
});

describe("portal selection convergence", () => {
  it("delegates selection and comments to the shared gallery mutation", async () => {
    await setPortalPhotoSelection("gallery-1", "photo-1", true, "Retocar");

    expect(mocks.updateSelectionForGallery).toHaveBeenCalledWith("gallery-1", {
      photoId: "photo-1",
      selected: true,
      comment: "Retocar",
    });
  });

  it("delegates final confirmation to the shared transaction with the account actor", async () => {
    await confirmPortalSelection("gallery-1", {
      sessionId: "session-1",
      accountId: "account-1",
      clientId: "client-1",
      email: "client@example.test",
    });

    expect(mocks.confirmSelectionForGallery).toHaveBeenCalledWith("gallery-1", {
      actorType: "ACCOUNT",
      actorId: "account-1",
    });
  });
});
