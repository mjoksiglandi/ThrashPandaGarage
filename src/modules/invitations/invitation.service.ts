import { AccountNotFoundError, InvalidCredentialsError } from "@/modules/accounts/account.errors";
import { normalizeAccountEmail } from "@/modules/accounts/account-email";
import type {
  AccountServiceStore,
  AccountServiceTransaction,
} from "@/modules/accounts/account-service.repository";
import type {
  Clock,
} from "@/modules/accounts/service-dependencies";
import { expiresAfter } from "@/modules/accounts/service-dependencies";
import type {
  OpaqueTokenGenerator,
  PasswordHasher,
  TokenHasher,
} from "@/modules/accounts/secure-token";
import { assertCanIssueInvitation } from "@/modules/accounts/account-workflow";
import {
  InvalidPasswordHashError,
  InvitationNotFoundError,
  PasswordHashingError,
} from "./invitation.errors";
import { assertCanAcceptInvitation } from "./invitation-workflow";

// Temporary defensive limits for PR 3. PR 4 owns the final password policy
// and real hashing algorithm. Values are measured as JavaScript UTF-16 units.
export const ACCEPTANCE_PASSWORD_MAX_LENGTH = 1024;
export const PASSWORD_HASH_MAX_LENGTH = 1024;

export type AccountSelector =
  | { accountId: string; email?: never }
  | { accountId?: never; email: string };

type InvitationServiceDependencies = {
  store: AccountServiceStore;
  clock: Clock;
  tokenGenerator: OpaqueTokenGenerator;
  tokenHasher: TokenHasher;
  passwordHasher: PasswordHasher;
  invitationDurationMs: number;
};

async function lockSelectedAccount(
  transaction: AccountServiceTransaction,
  selector: AccountSelector
) {
  if (selector.accountId !== undefined) {
    return transaction.lockAccountById(selector.accountId);
  }
  return transaction.lockAccountByEmail(
    normalizeAccountEmail(selector.email as string)
  );
}

function assertAcceptancePassword(
  password: unknown
): asserts password is string {
  if (
    typeof password !== "string" ||
    password.length === 0 ||
    password.trim().length === 0 ||
    password.length > ACCEPTANCE_PASSWORD_MAX_LENGTH
  ) {
    throw new InvalidCredentialsError();
  }
}

function assertPasswordHash(
  passwordHash: unknown
): asserts passwordHash is string {
  if (
    typeof passwordHash !== "string" ||
    passwordHash.length === 0 ||
    passwordHash.trim().length === 0 ||
    passwordHash.length > PASSWORD_HASH_MAX_LENGTH
  ) {
    throw new InvalidPasswordHashError();
  }
}

export function createInvitationService(
  dependencies: InvitationServiceDependencies
) {
  return {
    async issue(input: AccountSelector & { createdByActorId: string }) {
      const now = dependencies.clock.now();
      const expiresAt = expiresAfter(now, dependencies.invitationDurationMs);

      return dependencies.store.transaction(async (transaction) => {
        const account = await lockSelectedAccount(transaction, input);
        if (!account) {
          throw new AccountNotFoundError();
        }
        assertCanIssueInvitation(account);

        await transaction.revokePendingInvitations(account.id, now);

        const token = dependencies.tokenGenerator.generate();
        const tokenHash = dependencies.tokenHasher.digest(token);
        const invitation = await transaction.createInvitation({
          accountId: account.id,
          tokenHash,
          expiresAt,
          createdAt: now,
          createdByActorId: input.createdByActorId,
        });

        return {
          invitationId: invitation.id,
          accountId: account.id,
          expiresAt: invitation.expiresAt,
          token,
        };
      });
    },

    async accept(input: { token: string; password: string }) {
      assertAcceptancePassword(input.password);
      const now = dependencies.clock.now();
      const tokenHash = dependencies.tokenHasher.digest(input.token);

      return dependencies.store.transaction(async (transaction) => {
        const invitation =
          await transaction.lockInvitationByTokenHash(tokenHash);
        if (!invitation) {
          throw new InvitationNotFoundError();
        }

        assertCanAcceptInvitation(invitation, invitation.account, now);
        let passwordHash: unknown;
        try {
          passwordHash = await dependencies.passwordHasher.hash(input.password);
        } catch {
          throw new PasswordHashingError();
        }
        assertPasswordHash(passwordHash);

        await transaction.updateAccount(invitation.accountId, {
          passwordHash,
          status: "ACTIVE",
          failedLoginAttempts: 0,
          lockedUntil: null,
        });
        await transaction.acceptInvitation(invitation.id, now);
        await transaction.revokePendingInvitations(
          invitation.accountId,
          now,
          invitation.id
        );

        return {
          invitationId: invitation.id,
          accountId: invitation.accountId,
          acceptedAt: now,
          status: "ACTIVE" as const,
        };
      });
    },
  };
}
