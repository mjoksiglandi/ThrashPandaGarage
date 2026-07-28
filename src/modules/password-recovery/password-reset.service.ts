import type { TokenHash } from "@/lib/token-hash";
import {
  assertNewAccountPassword,
} from "@/modules/accounts/account-password-policy";
import type { Clock } from "@/modules/accounts/service-dependencies";
import {
  InvalidTokenError,
  type PasswordHasher,
  type TokenHasher,
} from "@/modules/accounts/secure-token";
import {
  isPasswordRecoveryUsable,
} from "./password-recovery.service";
import type {
  PasswordResetRecord,
  PasswordResetStore,
} from "./password-recovery.repository";

const invalidLookupHash = "0".repeat(64) as TokenHash;

export class PasswordResetUnavailableError extends Error {
  constructor() {
    super("Password reset unavailable");
    this.name = "PasswordResetUnavailableError";
  }
}

export class PasswordResetHashingError extends Error {
  constructor() {
    super("Password reset hashing failed");
    this.name = "PasswordResetHashingError";
  }
}

function isAccountUsable(recovery: PasswordResetRecord): boolean {
  return (
    recovery.account.status === "ACTIVE" &&
    recovery.account.passwordHash !== null
  );
}

function assertResetUsable(
  recovery: PasswordResetRecord | null,
  now: Date
): asserts recovery is PasswordResetRecord {
  if (
    !recovery ||
    !isPasswordRecoveryUsable(recovery, now) ||
    !isAccountUsable(recovery)
  ) {
    throw new PasswordResetUnavailableError();
  }
}

type PasswordResetServiceDependencies = {
  store: PasswordResetStore;
  clock: Clock;
  tokenHasher: Pick<TokenHasher, "digest">;
  passwordHasher: Pick<PasswordHasher, "hash">;
};

export function createPasswordResetService(
  dependencies: PasswordResetServiceDependencies
) {
  return {
    async reset(input: { token: unknown; password: unknown }) {
      assertNewAccountPassword(input.password);

      let structurallyValid = true;
      let tokenHash = invalidLookupHash;
      try {
        tokenHash = dependencies.tokenHasher.digest(input.token as string);
      } catch (error) {
        if (error instanceof InvalidTokenError) {
          structurallyValid = false;
        } else {
          throw error;
        }
      }

      const preliminary = await dependencies.store.findByTokenHash(tokenHash);
      if (!structurallyValid) {
        throw new PasswordResetUnavailableError();
      }
      assertResetUsable(preliminary, dependencies.clock.now());

      let passwordHash: string;
      try {
        passwordHash = await dependencies.passwordHasher.hash(input.password);
      } catch {
        throw new PasswordResetHashingError();
      }
      if (
        typeof passwordHash !== "string" ||
        passwordHash.length === 0 ||
        passwordHash.length > 1024
      ) {
        throw new PasswordResetHashingError();
      }

      return dependencies.store.transaction(async (transaction) => {
        const now = dependencies.clock.now();
        const recovery =
          await transaction.lockRequestByTokenHash(tokenHash);
        assertResetUsable(recovery, now);

        await transaction.updateAccount(recovery.accountId, {
          passwordHash,
        });
        if (!(await transaction.consumeRequest(recovery.id, now))) {
          throw new PasswordResetUnavailableError();
        }
        const revokedSessions = await transaction.revokeAllSessions(
          recovery.accountId,
          now
        );
        const revokedRecoveries = await transaction.revokeOpenRequests(
          recovery.accountId,
          now,
          recovery.id
        );

        return {
          accountId: recovery.accountId,
          recoveryId: recovery.id,
          consumedAt: now,
          revokedSessions,
          revokedRecoveries,
        };
      });
    },
  };
}

export type PasswordResetService = ReturnType<
  typeof createPasswordResetService
>;
