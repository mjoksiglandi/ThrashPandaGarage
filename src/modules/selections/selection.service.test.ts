import { describe, expect, it, vi } from "vitest";

vi.mock("./selection.repository", () => ({
  selectionRepository: {
    selectedForGallery: vi.fn(async () => [
      { comment: "me gusta para perfil", photo: { filename: "IMG_2031.webp", baseName: "IMG_2031" } },
      { comment: null, photo: { filename: "IMG_2044.webp", baseName: "IMG_2044" } },
      { comment: 'con "comillas", y coma', photo: { filename: "IMG_2050.webp", baseName: "IMG_2050" } },
    ]),
  },
}));

const { exportSelectionCsv } = await import("./selection.service");

describe("exportSelectionCsv", () => {
  it("produces a header plus one escaped row per selected photo", async () => {
    const csv = await exportSelectionCsv("gallery_1");
    const lines = csv.split("\n");

    expect(lines[0]).toBe("filename,baseName,comment");
    expect(lines[1]).toBe("IMG_2031.webp,IMG_2031,me gusta para perfil");
    expect(lines[2]).toBe("IMG_2044.webp,IMG_2044,");
    expect(lines[3]).toBe('IMG_2050.webp,IMG_2050,"con ""comillas"", y coma"');
  });
});
