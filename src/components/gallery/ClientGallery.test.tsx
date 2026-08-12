import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClientGallery } from "./ClientGallery";
import type { Photo } from "./gallery.types";

function makePhoto(id: string, selected = false): Photo {
  return {
    id,
    filename: `${id}.webp`,
    baseName: id,
    selected,
    comment: "",
    thumbUrl: "/thumb.webp",
    previewUrl: "/preview.webp",
  };
}

describe("ClientGallery submit-selection button", () => {
  it("keeps the confirm button visible (not removed) below the selection limit, with a styled disabled state", () => {
    const html = renderToStaticMarkup(
      <ClientGallery
        token="tok"
        title="Sesion Demo"
        selectionLimit={8}
        photos={[makePhoto("a", true)]}
        canShowDelivery={false}
        selectionOpen
        alreadyConfirmed={false}
      />
    );

    expect(html).toContain("Confirmar seleccion");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Confirmar seleccion<\/button>/);
    expect(html).toContain("Selecciona exactamente 8 fotos para poder confirmar.");
  });

  it("enables the confirm button once the selected count matches the limit exactly", () => {
    const photos = Array.from({ length: 8 }, (_, i) => makePhoto(`p${i}`, true));
    const html = renderToStaticMarkup(
      <ClientGallery
        token="tok"
        title="Sesion Demo"
        selectionLimit={8}
        photos={photos}
        canShowDelivery={false}
        selectionOpen
        alreadyConfirmed={false}
      />
    );

    expect(html).toMatch(/<button[^>]*>Confirmar seleccion<\/button>/);
    expect(html).not.toContain("Selecciona exactamente 8 fotos para poder confirmar.");
  });
});
