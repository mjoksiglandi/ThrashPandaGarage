import { db, type DbClient } from "@/lib/db";
import { assertTokenHash, type TokenHash } from "@/lib/token-hash";

type CreateAccountSessionInput = {
  accountId: string;
  tokenHash: TokenHash;
  expiresAt: Date;
};

export const accountSessionRepository = {
  findByTokenHash(tokenHash: TokenHash, client: DbClient = db) {
    assertTokenHash(tokenHash);
    return client.accountSession.findUnique({
      where: { tokenHash },
      include: { account: true },
    });
  },
  create(input: CreateAccountSessionInput, client: DbClient = db) {
    assertTokenHash(input.tokenHash);
    return client.accountSession.create({ data: input });
  },
};
