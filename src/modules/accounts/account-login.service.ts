import {
  AccountInactiveError,
  AccountLockedError,
  AccountNotFoundError,
  InvalidAccountEmailError,
  InvalidCredentialsError,
} from "./account.errors";
import { normalizeAccountEmail } from "./account-email";
import type { NormalizedAccountEmail } from "./account-email";
import type { AccountServiceStore } from "./account-service.repository";
import type {
  AuthenticationAttemptService,
} from "./authentication-attempt.service";
import type { PasswordHasher } from "./secure-token";
import type {
  AccountSessionService,
} from "@/modules/account-sessions/account-session.service";
import {
  LOGIN_EMAIL_MAX_LENGTH,
  LOGIN_PASSWORD_MAX_BYTES,
  LOGIN_PASSWORD_MAX_LENGTH,
} from "./account-login-policy";

export type AccountLoginInput = {
  email: NormalizedAccountEmail;
  password: string;
};

type AccountLoginServiceDependencies = {
  store: AccountServiceStore;
  authenticationAttempts: AuthenticationAttemptService;
  accountSessions: AccountSessionService;
  passwordVerifier: Pick<PasswordHasher, "verify">;
  nonexistentAccountPasswordHash: string;
};

const publicAuthenticationErrors = [
  AccountInactiveError,
  AccountLockedError,
  AccountNotFoundError,
  InvalidCredentialsError,
] as const;

function isPublicAuthenticationError(error: unknown): boolean {
  return publicAuthenticationErrors.some(
    (ErrorType) => error instanceof ErrorType
  );
}
export function parseAccountLoginInput(input: {
  email: unknown;
  password: unknown;
}): AccountLoginInput {
  if (
    typeof input.email !== "string" ||
    input.email.length > LOGIN_EMAIL_MAX_LENGTH ||
    typeof input.password !== "string" ||
    input.password.length === 0 ||
    input.password.trim().length === 0 ||
    input.password.length > LOGIN_PASSWORD_MAX_LENGTH ||
    Buffer.byteLength(input.password, "utf8") > LOGIN_PASSWORD_MAX_BYTES
  ) {
    throw new InvalidCredentialsError();
  }

  try {
    return {
      email: normalizeAccountEmail(input.email),
      password: input.password,
    };
  } catch (error) {
    if (error instanceof InvalidAccountEmailError) {
      throw new InvalidCredentialsError();
    }
    throw error;
  }
}

export function createAccountLoginService(
  dependencies: AccountLoginServiceDependencies
) {
  async function rejectAndRecordFailure(
    candidate: { id: string } | null,
    email: string
  ): Promise<never> {
    try {
      await dependencies.authenticationAttempts.recordFailedAttempt(
        candidate ? { accountId: candidate.id } : { email }
      );
    } catch (error) {
      if (!isPublicAuthenticationError(error)) {
        throw error;
      }
    }
    throw new InvalidCredentialsError();
  }

  return {
    async authenticate(rawInput: {
      email: unknown;
      password: unknown;
    }) {
      const input = parseAccountLoginInput(rawInput);
      const candidate =
        await dependencies.store.findAuthenticationAccountByEmail(
          input.email
        );
      const passwordHash =
        candidate?.passwordHash ??
        dependencies.nonexistentAccountPasswordHash;
      const passwordMatches = await dependencies.passwordVerifier.verify(
        input.password,
        passwordHash
      );

      if (!candidate || !candidate.passwordHash || !passwordMatches) {
        return rejectAndRecordFailure(candidate, input.email);
      }

      try {
        const created = await dependencies.store.transaction(
          async (transaction) => {
            const authenticated =
              await dependencies.authenticationAttempts
                .recordSuccessfulAuthenticationWithinTransaction(
                  transaction,
                  {
                    accountId: candidate.id,
                    expectedPasswordHash: candidate.passwordHash as string,
                  }
                );
            return dependencies.accountSessions.createWithinTransaction(
              transaction,
              authenticated.account,
              authenticated.lastLoginAt
            );
          }
        );

        return {
          token: created.token,
          expiresAt: created.expiresAt,
        };
      } catch (error) {
        if (isPublicAuthenticationError(error)) {
          throw new InvalidCredentialsError();
        }
        throw error;
      }
    },
  };
}
