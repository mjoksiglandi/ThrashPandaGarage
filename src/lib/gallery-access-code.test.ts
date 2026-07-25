import { describe, expect, it } from "vitest";
import { parseGalleryAccessCode } from "./gallery-access-code";

describe("parseGalleryAccessCode", () => {
  it("accepts a raw access token", () => {
    expect(parseGalleryAccessCode("  tpg_example  ")).toBe("tpg_example");
  });

  it("extracts the token from a gallery URL", () => {
    expect(parseGalleryAccessCode("https://example.com/g/tpg_example")).toBe("tpg_example");
  });

  it("rejects unrelated URLs", () => {
    expect(parseGalleryAccessCode("https://example.com/contact")).toBe("");
  });
});
