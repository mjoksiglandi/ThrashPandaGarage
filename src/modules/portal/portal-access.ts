import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ACCOUNT_SESSION_COOKIE_NAME,
  clearedAccountSessionCookie,
} from "@/modules/account-sessions/account-session-cookie";
import {
  logoutAccountSessionToken,
  resolveAccountSessionToken,
} from "@/modules/account-sessions/current-account-session";
import {
  LEGACY_CLIENT_COOKIE_NAME,
  resolveLegacyClientId,
} from "@/lib/client-auth";
import { clientRepository } from "@/modules/clients/client.repository";
import { createPortalActorResolver } from "./portal-actor.service";

const portalActors = createPortalActorResolver({
  accountSessions: {
    resolve: resolveAccountSessionToken,
  },
  legacySessions: {
    resolveClientId: resolveLegacyClientId,
  },
});

export async function resolveCurrentPortalActor() {
  const cookieStore = await cookies();
  return portalActors.resolve({
    accountSessionCookie: cookieStore.get(
      ACCOUNT_SESSION_COOKIE_NAME
    )?.value,
    legacyClientCookie: cookieStore.get(
      LEGACY_CLIENT_COOKIE_NAME
    )?.value,
  });
}

export async function requirePortalClient() {
  const actor = await resolveCurrentPortalActor();
  if (actor.kind === "anonymous") {
    redirect("/portal/login");
  }

  const client = await clientRepository.find(actor.clientId);
  if (!client) {
    redirect("/portal/login");
  }

  return { actor, client };
}

export async function logoutPortalActor() {
  const cookieStore = await cookies();
  const accountToken = cookieStore.get(
    ACCOUNT_SESSION_COOKIE_NAME
  )?.value;

  try {
    await logoutAccountSessionToken(accountToken);
  } finally {
    const cleared = clearedAccountSessionCookie();
    cookieStore.set(cleared.name, cleared.value, cleared.options);
    cookieStore.delete(LEGACY_CLIENT_COOKIE_NAME);
  }
}
