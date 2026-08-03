import type { AccountSessionPrincipal } from "@/modules/account-sessions/current-account-session.service";

export type AccountGalleryEventActor = {
  actorType: "ACCOUNT";
  actorId: string;
};

export function accountGalleryEventActor(
  principal: AccountSessionPrincipal
): AccountGalleryEventActor {
  if (!principal.accountId.trim()) {
    throw new Error("Account actorId is required");
  }

  return {
    actorType: "ACCOUNT",
    actorId: principal.accountId,
  };
}
