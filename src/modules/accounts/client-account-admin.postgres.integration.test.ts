import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";

const mocks = vi.hoisted(() => ({
  sendAccountInvitationEmail: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/modules/mail/account-invitation-mail", () => ({
  sendAccountInvitationEmail: mocks.sendAccountInvitationEmail,
}));

import {
  createClientAccountAndInvite,
  resendClientAccountInvitation,
} from "./client-account-admin";
import { acceptAccountInvitation } from "@/modules/invitations/invitation-acceptance";

const createdClientIds: string[] = [];

afterEach(async () => {
  mocks.sendAccountInvitationEmail.mockReset();
  await db.client.deleteMany({ where: { id: { in: createdClientIds } } });
  createdClientIds.length = 0;
});

describe("client account administration PostgreSQL flow", () => {
  it("moves a fresh client to an active account through the existing invitation acceptance", async () => {
    mocks.sendAccountInvitationEmail.mockResolvedValue(undefined);
    const client = await db.client.create({
      data: {
        name: `pr12_${Date.now()}`,
        email: `pr12_${Date.now()}@example.test`,
      },
    });
    createdClientIds.push(client.id);

    const issued = await createClientAccountAndInvite({
      clientId: client.id,
      actorId: "admin-pr12",
    });
    const invited = await db.client.findUniqueOrThrow({
      where: { id: client.id },
      include: { account: { include: { invitations: true } } },
    });

    expect(invited.account).toMatchObject({
      email: client.email,
      status: "INVITED",
      passwordHash: null,
    });
    expect(invited.account?.invitations).toHaveLength(1);
    expect(invited.account?.invitations[0]).toMatchObject({
      id: issued.invitationId,
      createdByActorId: "admin-pr12",
      acceptedAt: null,
      revokedAt: null,
    });
    expect(mocks.sendAccountInvitationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: client.email, token: issued.token })
    );

    await acceptAccountInvitation({
      token: issued.token,
      password: "a-secure-pr12-password",
    });
    const activated = await db.client.findUniqueOrThrow({
      where: { id: client.id },
      include: { account: { include: { invitations: true } } },
    });

    expect(activated.account?.status).toBe("ACTIVE");
    expect(activated.account?.passwordHash).not.toBeNull();
    expect(activated.account?.invitations[0].acceptedAt).toBeInstanceOf(Date);
  });

  it("revokes the previous pending invitation when an admin resends", async () => {
    mocks.sendAccountInvitationEmail.mockResolvedValue(undefined);
    const client = await db.client.create({
      data: {
        name: `pr12_resend_${Date.now()}`,
        email: `pr12_resend_${Date.now()}@example.test`,
      },
    });
    createdClientIds.push(client.id);

    const first = await createClientAccountAndInvite({
      clientId: client.id,
      actorId: "admin-first",
    });
    const second = await resendClientAccountInvitation({
      clientId: client.id,
      actorId: "admin-second",
    });
    const invitations = await db.invitation.findMany({
      where: { accountId: first.accountId },
      orderBy: { createdAt: "asc" },
    });

    expect(invitations).toHaveLength(2);
    expect(invitations[0].revokedAt).toBeInstanceOf(Date);
    expect(invitations[1]).toMatchObject({
      id: second.invitationId,
      createdByActorId: "admin-second",
      revokedAt: null,
      acceptedAt: null,
    });
  });
});
