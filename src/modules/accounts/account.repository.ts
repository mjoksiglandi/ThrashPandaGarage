import { AccountStatus } from "@prisma/client";
import { db, type DbClient } from "@/lib/db";
import { normalizeAccountEmail } from "./account-email";
import { InvalidAccountCreationError } from "./account.errors";

type CreateInvitedAccountInput = {
  clientId: string;
  email: string;
  passwordHash?: null;
  status?: typeof AccountStatus.INVITED;
};

type CreateActiveAccountInput = {
  clientId: string;
  email: string;
  passwordHash: string;
  status: typeof AccountStatus.ACTIVE;
};

type CreateAccountInput = CreateInvitedAccountInput | CreateActiveAccountInput;

export const accountRepository = {
  find(id: string, client: DbClient = db) {
    return client.account.findUnique({ where: { id } });
  },
  findByEmail(email: string, client: DbClient = db) {
    return client.account.findUnique({
      where: { email: normalizeAccountEmail(email) },
    });
  },
  create(input: CreateAccountInput, client: DbClient = db) {
    const status = input.status ?? AccountStatus.INVITED;
    if (
      (status === AccountStatus.INVITED && input.passwordHash != null) ||
      (status === AccountStatus.ACTIVE && !input.passwordHash)
    ) {
      throw new InvalidAccountCreationError();
    }

    return client.account.create({
      data: {
        ...input,
        status,
        email: normalizeAccountEmail(input.email),
      },
    });
  },
};
