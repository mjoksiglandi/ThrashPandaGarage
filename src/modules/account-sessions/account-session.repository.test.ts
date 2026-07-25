import { describe, expect, it, vi } from "vitest";
import { InvalidTokenHashError, type TokenHash } from "@/lib/token-hash";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    accountSession: {
      create: mocks.create,
      findUnique: mocks.findUnique,
    },
  },
}));

import { accountSessionRepository } from "./account-session.repository";

describe("accountSessionRepository token boundary", () => {
  it("rejects a plain token before querying", () => {
    expect(() =>
      accountSessionRepository.findByTokenHash(
        "plain-session-token" as TokenHash
      )
    ).toThrow(InvalidTokenHashError);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a plain token before persistence", () => {
    expect(() =>
      accountSessionRepository.create({
        accountId: "account-1",
        tokenHash: "plain-session-token" as TokenHash,
        expiresAt: new Date("2026-08-25T12:00:00.000Z"),
      })
    ).toThrow(InvalidTokenHashError);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
