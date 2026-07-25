import { describe, expect, it } from "vitest";
import { buildCollage, buildJustifiedRows, type PhotoItem } from "./photo-collage-layout";

const photos: PhotoItem[] = [
  { title: "A", image: "/a.webp", alt: "A" },
  { title: "B", image: "/b.webp", alt: "B" },
  { title: "C", image: "/c.webp", alt: "C" },
];

describe("photo collage layout", () => {
  it("keeps the original indexes when randomization is disabled", () => {
    expect(buildCollage(photos, false).map((photo) => photo.originalIndex)).toEqual([0, 1, 2]);
  });

  it("builds rows whose computed widths fill the gallery", () => {
    const sized = buildCollage(photos, false).map((photo) => ({ ...photo, ratio: 1 }));
    const rows = buildJustifiedRows(sized, 640);

    expect(rows).not.toHaveLength(0);
    for (const row of rows) {
      const photoWidth = row.photos.reduce((sum, photo) => sum + photo.ratio * row.height, 0);
      expect(photoWidth + (row.photos.length - 1) * 18).toBeCloseTo(640);
    }
  });
});
