import { GalleryStatus } from "@prisma/client";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  findByToken: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/modules/galleries/gallery.repository", () => ({
  galleryRepository: { findByToken: mocks.findByToken },
}));

import PrivateGalleryPage from "./page";

const gallery = {
  id: "gallery-1",
  title: "Gallery",
  accessToken: "token-1",
  status: GalleryStatus.PROOFING,
  selectionLimit: 1,
  expiresAt: null,
  selectionConfirmedAt: null,
  deliveryDriveUrl: null,
  client: { name: "Client" },
  photos: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findByToken.mockResolvedValue(gallery);
  mocks.notFound.mockImplementation(() => {
    throw new Error("NEXT_NOT_FOUND");
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("private gallery capability props", () => {
  it("opens controls only for an active PROOFING gallery", async () => {
    const result = await PrivateGalleryPage({
      params: Promise.resolve({ token: "token-1" }),
    });

    expect(result.props.selectionOpen).toBe(true);
    expect(result.props.alreadyConfirmed).toBe(false);
    expect(mocks.findByToken).toHaveBeenCalledWith("token-1");
  });

  it.each([
    {
      label: "archived",
      status: GalleryStatus.ARCHIVED,
      expiresAt: null,
    },
    {
      label: "expires exactly now",
      status: GalleryStatus.PROOFING,
      expiresAt: new Date("2030-01-02T03:04:05.000Z"),
    },
  ])("keeps public token access closed for $label galleries", async (state) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-02T03:04:05.000Z"));
    mocks.findByToken.mockResolvedValueOnce({
      ...gallery,
      status: state.status,
      expiresAt: state.expiresAt,
    });

    await expect(
      PrivateGalleryPage({
        params: Promise.resolve({ token: "token-1" }),
      })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.findByToken).toHaveBeenCalledWith("token-1");
  });

  it.each([
    GalleryStatus.SELECTION_CONFIRMED,
    GalleryStatus.EDITING,
    GalleryStatus.READY_FOR_DELIVERY,
    GalleryStatus.DELIVERED,
  ])("keeps controls closed after confirmation in %s", async (status) => {
    mocks.findByToken.mockResolvedValueOnce({
      ...gallery,
      status,
      selectionConfirmedAt: new Date("2026-07-24T01:00:00.000Z"),
    });

    const result = await PrivateGalleryPage({
      params: Promise.resolve({ token: "token-1" }),
    });

    expect(result.props.selectionOpen).toBe(false);
    expect(result.props.alreadyConfirmed).toBe(true);
  });
});
