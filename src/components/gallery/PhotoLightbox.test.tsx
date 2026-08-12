import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PhotoLightbox } from "./PhotoLightbox";
import type { Photo } from "./gallery.types";

const photo: Photo = {
  id: "photo-1",
  filename: "DEMO_01.webp",
  baseName: "DEMO_01",
  selected: false,
  comment: "",
  thumbUrl: "/thumb.webp",
  previewUrl: "/preview.webp",
};

describe("PhotoLightbox selection control", () => {
  it("renders a clickable selection button, not a static status label", () => {
    const html = renderToStaticMarkup(
      <PhotoLightbox
        photo={photo}
        onClose={() => {}}
        onToggleSelected={() => {}}
        onCommentChange={() => {}}
        selectionOpen
      />
    );

    expect(html).toContain("Seleccionar foto");
    expect(html).toMatch(/<button[^>]*>Seleccionar foto<\/button>/);
  });

  it("disables the selection control once selection is closed", () => {
    const html = renderToStaticMarkup(
      <PhotoLightbox
        photo={{ ...photo, selected: true }}
        onClose={() => {}}
        onToggleSelected={() => {}}
        onCommentChange={() => {}}
        selectionOpen={false}
      />
    );

    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>✓ Seleccionada<\/button>/);
  });
});
