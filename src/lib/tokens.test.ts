import { describe, expect, it } from "vitest";
import { slugify } from "./tokens";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Karim — Misato Evangelion")).toBe("karim-misato-evangelion");
  });

  it("strips accents", () => {
    expect(slugify("Selección Cliente")).toBe("seleccion-cliente");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  --Hola Mundo--  ")).toBe("hola-mundo");
  });
});
