import {
  AccountInactiveError,
  AccountLockedError,
} from "@/modules/accounts/account.errors";
import { InvalidTokenError } from "@/modules/accounts/secure-token";
import type { AccountSessionService } from "./account-session.service";
import {
  AccountSessionExpiredError,
  AccountSessionNotFoundError,
  AccountSessionRevokedError,
} from "./account-session.errors";

export type AccountSessionPrincipal = {
  sessionId: string;
  accountId: string;
  clientId: string;
  email: string;
};

export type AccountSessionResolution =
  | {
      kind: "authenticated";
      principal: AccountSessionPrincipal;
    }
  | {
      kind: "unauthenticated";
    };

type CurrentAccountSessionDependencies = {
  accountSessions: Pick<AccountSessionService, "validate" | "revoke">;
};

const unauthenticatedSessionErrors = [
  InvalidTokenError,
  AccountSessionNotFoundError,
  AccountSessionExpiredError,
  AccountSessionRevokedError,
  AccountInactiveError,
  AccountLockedError,
] as const;

function isUnauthenticatedSessionError(error: unknown): boolean {
  return unauthenticatedSessionErrors.some(
    (ErrorType) => error instanceof ErrorType
  );
}

export function createCurrentAccountSessionService(
  dependencies: CurrentAccountSessionDependencies
) {
  return {
    async resolve(
      token: string | undefined
    ): Promise<AccountSessionResolution> {
      if (!token) {
        return { kind: "unauthenticated" };
      }

      try {
        const session = await dependencies.accountSessions.validate(token);
        return {
          kind: "authenticated",
          principal: {
            sessionId: session.sessionId,
            accountId: session.accountId,
            clientId: session.clientId,
            email: session.email,
          },
        };
      } catch (error) {
        if (isUnauthenticatedSessionError(error)) {
          return { kind: "unauthenticated" };
        }
        throw error;
      }
    },

    async logout(token: string | undefined): Promise<void> {
      if (!token) {
        return;
      }

      try {
        await dependencies.accountSessions.revoke(token);
      } catch (error) {
        if (
          error instanceof InvalidTokenError ||
          error instanceof AccountSessionNotFoundError
        ) {
          return;
        }
        throw error;
      }
    },
  };
}

export type CurrentAccountSessionService = ReturnType<
  typeof createCurrentAccountSessionService
>;
