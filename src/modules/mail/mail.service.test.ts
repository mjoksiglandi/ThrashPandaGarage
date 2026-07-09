import { describe, expect, it } from "vitest";
import { galleryEmailText } from "./mail.service";

describe("galleryEmailText", () => {
  it("uses accented Spanish copy and the client name/url", () => {
    const text = galleryEmailText("Karim", "https://example.com/g/tpg_abc");

    const expectedText = `Hola, Karim.

Tu galería de selección ya está disponible:

https://example.com/g/tpg_abc

Puedes revisar las fotos, marcar tus favoritas y dejar comentarios si necesitas indicar algo específico.

Cuando termines, presiona "Confirmar selección" para que pueda avanzar con la edición final.

Gracias por confiar en Trashpanda Garage.

— Gormm`;

    expect(text).toBe(expectedText);
  });
});
