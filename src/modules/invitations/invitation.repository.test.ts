import { describe, expect, it, vi } from "vitest";
import { InvalidTokenHashError, type TokenHash } from "@/lib/token-hash";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    invitation: {
      create: mocks.create,
      findUnique: mocks.findUnique,
    },
  },
}));

import { invitationRepository } from "./invitation.repository";

describe("invitationRepository token boundary", () => {
  it("rejects a plain token before querying", () => {
    expect(() =>
      invitationRepository.findByTokenHash(
        "plain-invitation-token" as TokenHash
      )
    ).toThrow(InvalidTokenHashError);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a plain token before persistence", () => {
    expect(() =>
      invitationRepository.create({
        accountId: "account-1",
        tokenHash: "plain-invitation-token" as TokenHash,
        expiresAt: new Date("2026-07-26T12:00:00.000Z"),
        createdByActorId: "admin-1",
      })
    ).toThrow(InvalidTokenHashError);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
