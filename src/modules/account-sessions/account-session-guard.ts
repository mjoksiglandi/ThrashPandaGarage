import "server-only";

import { resolveCurrentAccountSession } from "./current-account-session";
import { requireAuthenticatedAccount } from "./account-session-http";

export async function requireAccountSession() {
  return requireAuthenticatedAccount(
    await resolveCurrentAccountSession()
  );
}
