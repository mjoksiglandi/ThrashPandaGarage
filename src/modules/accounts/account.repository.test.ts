import { AccountStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvalidAccountCreationError } from "./account.errors";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    account: {
      create: mocks.create,
      findUnique: mocks.findUnique,
    },
  },
}));

import { accountRepository } from "./account.repository";

describe("accountRepository invariants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({ id: "account-1" });
    mocks.findUnique.mockResolvedValue(null);
  });

  it("normalizes email on create", async () => {
    await accountRepository.create({
      clientId: "client-1",
      email: "  Client.Name@Example.COM ",
    });

    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        clientId: "client-1",
        email: "client.name@example.com",
        status: AccountStatus.INVITED,
      },
    });
  });

  it("normalizes email on lookup", async () => {
    await accountRepository.findByEmail("  Client.Name@Example.COM ");

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { email: "client.name@example.com" },
    });
  });

  it("rejects creating INVITED with a password hash", () => {
    expect(() =>
      accountRepository.create({
        clientId: "client-1",
        email: "client@example.com",
        status: AccountStatus.INVITED,
        passwordHash: "legacy-hash",
      } as never)
    ).toThrow(InvalidAccountCreationError);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects creating ACTIVE without a password hash", () => {
    expect(() =>
      accountRepository.create({
        clientId: "client-1",
        email: "client@example.com",
        status: AccountStatus.ACTIVE,
      } as never)
    ).toThrow(InvalidAccountCreationError);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
