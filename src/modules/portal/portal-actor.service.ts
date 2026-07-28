import type {
  AccountSessionResolution,
  CurrentAccountSessionService,
} from "@/modules/account-sessions/current-account-session.service";

type PortalActor =
  | {
      kind: "account";
      accountId: string;
      clientId: string;
      email: string;
    }
  | {
      kind: "anonymous";
    };

type PortalActorResolverDependencies = {
  accountSessions: Pick<CurrentAccountSessionService, "resolve">;
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
    async resolve(
      accountSessionCookie: string | undefined
    ): Promise<PortalActor> {
      const accountSession = await dependencies.accountSessions.resolve(
        accountSessionCookie
      );
      if (accountSession.kind === "authenticated") {
        return accountActor(accountSession);
      }

      return { kind: "anonymous" };
    },
  };
}
