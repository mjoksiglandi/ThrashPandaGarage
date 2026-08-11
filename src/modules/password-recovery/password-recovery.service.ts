import {
  InvalidAccountEmailError,
} from "@/modules/accounts/account.errors";
import {
  normalizeAccountEmail,
  type NormalizedAccountEmail,
} from "@/modules/accounts/account-email";
import {
  expiresAfter,
  type Clock,
} from "@/modules/accounts/service-dependencies";
import type {
  OpaqueTokenGenerator,
  TokenHasher,
} from "@/modules/accounts/secure-token";
import type {
  PasswordRecoveryRecord,
  PasswordRecoveryStore,
} from "./password-recovery.repository";

export const PASSWORD_RECOVERY_DURATION_MS = 60 * 60 * 1000;
const PASSWORD_RECOVERY_EMAIL_MAX_LENGTH = 254;

export type PasswordRecoveryState = Pick<
  PasswordRecoveryRecord,
  "expiresAt" | "consumedAt" | "revokedAt"
>;

export function isPasswordRecoveryUsable(
  recovery: PasswordRecoveryState,
  now: Date
): boolean {
  return (
    recovery.consumedAt === null &&
    recovery.revokedAt === null &&
    recovery.expiresAt > now
  );
}
export function parsePasswordRecoveryEmail(
  value: unknown
): NormalizedAccountEmail {
  if (
    typeof value !== "string" ||
    value.length > PASSWORD_RECOVERY_EMAIL_MAX_LENGTH
  ) {
    throw new InvalidAccountEmailError();
  }
  return normalizeAccountEmail(value);
}

type PasswordRecoveryServiceDependencies = {
  store: PasswordRecoveryStore;
  clock: Clock;
  tokenGenerator: OpaqueTokenGenerator;
  tokenHasher: Pick<TokenHasher, "digest">;
  durationMs: number;
  mailer: {
    send(input: {
      to: string;
      token: string;
      expiresInMinutes: number;
    }): Promise<void>;
  };
  logger: {
    deliveryFailed(input: {
      recoveryId: string;
      accountId: string;
    }): void;
  };
};

function canReceivePasswordRecovery(account: {
  status: string;
  passwordHash: string | null;
}): boolean {
  return account.status === "ACTIVE" && account.passwordHash !== null;
}

export function createPasswordRecoveryService(
  dependencies: PasswordRecoveryServiceDependencies
) {
  return {
    async request(email: NormalizedAccountEmail): Promise<void> {
      const candidate = await dependencies.store.findAccountByEmail(email);
      if (!candidate) {
        return;
      }

      const created = await dependencies.store.transaction(
        async (transaction) => {
          const account = await transaction.lockAccountById(candidate.id);
          if (!account || !canReceivePasswordRecovery(account)) {
            return null;
          }

          const now = dependencies.clock.now();
          const token = dependencies.tokenGenerator.generate();
          const tokenHash = dependencies.tokenHasher.digest(token);
          await transaction.revokeOpenRequests(account.id, now);
          const recovery = await transaction.createRequest({
            accountId: account.id,
            tokenHash,
            expiresAt: expiresAfter(now, dependencies.durationMs),
            createdAt: now,
          });
          return {
            account,
            recovery,
            token,
          };
        }
      );

      if (!created) {
        return;
      }

      try {
        await dependencies.mailer.send({
          to: created.account.email,
          token: created.token,
          expiresInMinutes: dependencies.durationMs / 60_000,
        });
      } catch {
        try {
          await dependencies.store.revokeAfterDeliveryFailure(
            created.recovery.id,
            dependencies.clock.now()
          );
        } finally {
          dependencies.logger.deliveryFailed({
            recoveryId: created.recovery.id,
            accountId: created.account.id,
          });
        }
      }
    },
  };
}
