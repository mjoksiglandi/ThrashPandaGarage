import { describe, expect, it } from "vitest";
import { galleryEmailText } from "./mail.service";

describe("galleryEmailText", () => {
  it("uses accented Spanish copy and the client name/url", () => {
    const text = galleryEmailText("Karim", "https://example.com/g/tpg_abc");

    expect(text).toContain("Hola, Karim.");
    expect(text).toContain("Tu galería de selección ya está disponible:");
    expect(text).toContain("https://example.com/g/tpg_abc");
    expect(text).toContain("Confirmar selección");
    expect(text).toContain("edición final");
    expect(text).toContain("— Gormm");
  });
});
