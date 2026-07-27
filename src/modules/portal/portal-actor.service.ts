import type {
  AccountSessionResolution,
  CurrentAccountSessionService,
} from "@/modules/account-sessions/current-account-session.service";

export type PortalActor =
  | {
      kind: "account";
      accountId: string;
      clientId: string;
      email: string;
    }
  | {
      kind: "legacy";
      clientId: string;
    }
  | {
      kind: "anonymous";
    };

type PortalActorResolverDependencies = {
  accountSessions: Pick<CurrentAccountSessionService, "resolve">;
  legacySessions: {
    resolveClientId(cookie: string): Promise<string | null>;
  };
};

function accountActor(
  resolution: Extract<AccountSessionResolution, { kind: "authenticated" }>
): PortalActor {
  return {
    kind: "account",
    accountId: resolution.principal.accountId,
    clientId: resolution.principal.clientId,
    email: resolution.principal.email,
  };
}

export function createPortalActorResolver(
  dependencies: PortalActorResolverDependencies
) {
  return {
    async resolve(input: {
      accountSessionCookie?: string;
      legacyClientCookie?: string;
    }): Promise<PortalActor> {
      if (input.accountSessionCookie !== undefined) {
        const accountSession = await dependencies.accountSessions.resolve(
          input.accountSessionCookie
        );
        if (accountSession.kind === "authenticated") {
          return accountActor(accountSession);
        }
        return { kind: "anonymous" };
      }

      if (input.legacyClientCookie !== undefined) {
        const clientId = await dependencies.legacySessions.resolveClientId(
          input.legacyClientCookie
        );
        if (clientId) {
          return { kind: "legacy", clientId };
        }
      }

      return { kind: "anonymous" };
    },
  };
}

export type PortalActorResolver = ReturnType<
  typeof createPortalActorResolver
>;
