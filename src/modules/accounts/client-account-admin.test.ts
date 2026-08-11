import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  transactionClientFindUnique: vi.fn(),
  accountCreate: vi.fn(),
  accountFindUnique: vi.fn(),
  clientFindUnique: vi.fn(),
  issue: vi.fn(),
  sendAccountInvitationEmail: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: {
    $transaction: mocks.transaction,
    client: { findUnique: mocks.clientFindUnique },
  },
}));
vi.mock("@/modules/invitations/invitation.service", () => ({
  createInvitationService: () => ({ issue: mocks.issue }),
}));
vi.mock("@/modules/mail/account-invitation-mail", () => ({
  sendAccountInvitationEmail: mocks.sendAccountInvitationEmail,
}));
vi.mock("./account-service.repository", () => ({
  createPrismaAccountServiceStore: vi.fn(() => ({})),
}));

import {
  ACCOUNT_INVITATION_DURATION_DAYS,
  ClientAccountAlreadyExistsError,
  ClientAccountEmailAlreadyUsedError,
  ClientAccountEmailRequiredError,
  createClientAccountAndInvite,
  resendClientAccountInvitation,
} from "./client-account-admin";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation((work) =>
    work({
      client: { findUnique: mocks.transactionClientFindUnique },
      account: {
        create: mocks.accountCreate,
        findUnique: mocks.accountFindUnique,
      },
    })
  );
  mocks.accountCreate.mockResolvedValue({
    id: "account-1",
    email: "person@example.test",
  });
  mocks.accountFindUnique.mockResolvedValue(null);
  mocks.issue.mockResolvedValue({
    invitationId: "invitation-1",
    accountId: "account-1",
    token: "A".repeat(43),
    expiresAt: new Date("2026-08-17T12:00:00.000Z"),
  });
  mocks.sendAccountInvitationEmail.mockResolvedValue(undefined);
});

describe("client account administration", () => {
  it("creates one invited account and issues through the Slice 1 service", async () => {
    mocks.transactionClientFindUnique.mockResolvedValue({
      email: " Person@Example.TEST ",
      account: null,
    });

    await createClientAccountAndInvite({
      clientId: "client-1",
      actorId: "admin-1",
    });

    expect(mocks.accountCreate).toHaveBeenCalledWith({
      data: {
        clientId: "client-1",
        email: "person@example.test",
        status: "INVITED",
      },
      select: { id: true, email: true },
    });
    expect(mocks.issue).toHaveBeenCalledWith({
      accountId: "account-1",
      createdByActorId: "admin-1",
    });
    expect(mocks.sendAccountInvitationEmail).toHaveBeenCalledWith({
      to: "person@example.test",
      token: "A".repeat(43),
      expiresInDays: ACCOUNT_INVITATION_DURATION_DAYS,
    });
  });

  it("refuses to create a second account for the same client", async () => {
    mocks.transactionClientFindUnique.mockResolvedValue({
      email: "person@example.test",
      account: { id: "account-existing" },
    });

    await expect(
      createClientAccountAndInvite({
        clientId: "client-1",
        actorId: "admin-1",
      })
    ).rejects.toBeInstanceOf(ClientAccountAlreadyExistsError);
    expect(mocks.accountCreate).not.toHaveBeenCalled();
    expect(mocks.issue).not.toHaveBeenCalled();
  });

  it("requires a client email before creating the account", async () => {
    mocks.transactionClientFindUnique.mockResolvedValue({
      email: null,
      account: null,
    });

    await expect(
      createClientAccountAndInvite({
        clientId: "client-1",
        actorId: "admin-1",
      })
    ).rejects.toBeInstanceOf(ClientAccountEmailRequiredError);
    expect(mocks.accountCreate).not.toHaveBeenCalled();
  });

  it("refuses an email already linked to another account", async () => {
    mocks.transactionClientFindUnique.mockResolvedValue({
      email: "person@example.test",
      account: null,
    });
    mocks.accountFindUnique.mockResolvedValue({ id: "account-other" });

    await expect(
      createClientAccountAndInvite({
        clientId: "client-1",
        actorId: "admin-1",
      })
    ).rejects.toBeInstanceOf(ClientAccountEmailAlreadyUsedError);
    expect(mocks.accountCreate).not.toHaveBeenCalled();
  });

  it("resends to the immutable account email and preserves the admin actor", async () => {
    mocks.clientFindUnique.mockResolvedValue({
      account: { id: "account-1", email: "account@example.test" },
    });

    await resendClientAccountInvitation({
      clientId: "client-1",
      actorId: "admin-2",
    });

    expect(mocks.issue).toHaveBeenCalledWith({
      accountId: "account-1",
      createdByActorId: "admin-2",
    });
    expect(mocks.sendAccountInvitationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "account@example.test" })
    );
  });
});
