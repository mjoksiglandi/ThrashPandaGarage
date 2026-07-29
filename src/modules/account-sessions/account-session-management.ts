import "server-only";

import { createPrismaAccountSessionManagementStore } from "./account-session-management.repository";
import { createAccountSessionManagementService } from "./account-session-management.service";

const service = createAccountSessionManagementService({
  store: createPrismaAccountSessionManagementStore(),
  clock: { now: () => new Date() },
});

export const listActiveAccountSessions = service.list;
export const revokeOwnedAccountSession = service.revokeOwned;
