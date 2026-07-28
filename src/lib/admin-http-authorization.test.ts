import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("administrative HTTP authorization", () => {
  it("enables Next.js 403 responses for forbidden roles", () => {
    expect(nextConfig.experimental?.authInterrupts).toBe(true);
  });
});
