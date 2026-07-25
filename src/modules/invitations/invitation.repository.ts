import { db, type DbClient } from "@/lib/db";
import { assertTokenHash, type TokenHash } from "@/lib/token-hash";

type CreateInvitationInput = {
  accountId: string;
  tokenHash: TokenHash;
  expiresAt: Date;
  createdByActorId: string;
};

export const invitationRepository = {
  findByTokenHash(tokenHash: TokenHash, client: DbClient = db) {
    assertTokenHash(tokenHash);
    return client.invitation.findUnique({
      where: { tokenHash },
      include: { account: true },
    });
  },
  create(input: CreateInvitationInput, client: DbClient = db) {
    assertTokenHash(input.tokenHash);
    return client.invitation.create({ data: input });
  },
};
