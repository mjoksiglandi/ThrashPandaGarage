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
import { InvalidTokenError } from "@/modules/accounts/secure-token";
import type { TokenHash } from "@/lib/token-hash";
import { assertCanIssueInvitation } from "@/modules/accounts/account-workflow";
import {
  InvalidPasswordHashError,
  InvitationNotFoundError,
  PasswordHashingError,
} from "./invitation.errors";
import { assertCanAcceptInvitation } from "./invitation-workflow";

// The password is never trimmed or otherwise transformed before hashing.
// bcrypt consumes at most 72 UTF-8 bytes, so longer inputs are rejected rather
// than silently colliding after the algorithm's truncation boundary.
export const ACCEPTANCE_PASSWORD_MIN_LENGTH = 12;
export const ACCEPTANCE_PASSWORD_MAX_LENGTH = 72;
export const ACCEPTANCE_PASSWORD_MAX_BYTES = 72;
export const PASSWORD_HASH_MAX_LENGTH = 1024;
const invalidLookupHash = "0".repeat(64) as TokenHash;

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

type InvitationAcceptanceServiceDependencies = Pick<
  InvitationServiceDependencies,
  "store" | "clock" | "tokenHasher" | "passwordHasher"
>;

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
    password.length < ACCEPTANCE_PASSWORD_MIN_LENGTH ||
    password.trim().length === 0 ||
    password.length > ACCEPTANCE_PASSWORD_MAX_LENGTH ||
    Buffer.byteLength(password, "utf8") > ACCEPTANCE_PASSWORD_MAX_BYTES
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

export function createInvitationAcceptanceService(
  dependencies: InvitationAcceptanceServiceDependencies
) {
  return {
    async accept(input: { token: string; password: string }) {
      assertAcceptancePassword(input.password);
      const now = dependencies.clock.now();
      let structurallyValid = true;
      let tokenHash = invalidLookupHash;
      try {
        tokenHash = dependencies.tokenHasher.digest(input.token);
      } catch (error) {
        if (error instanceof InvalidTokenError) {
          structurallyValid = false;
        } else {
          throw error;
        }
      }

      return dependencies.store.transaction(async (transaction) => {
        const invitation =
          await transaction.lockInvitationByTokenHash(tokenHash);
        if (!structurallyValid || !invitation) {
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

export function createInvitationService(
  dependencies: InvitationServiceDependencies
) {
  const acceptanceService = createInvitationAcceptanceService(dependencies);

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
    accept: acceptanceService.accept,
  };
}
