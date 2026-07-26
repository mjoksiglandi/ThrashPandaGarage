import type { AccountStatusValue } from "@/modules/accounts/account.types";
import {
  InvitationAccountNotFoundError,
  InvitationAccountStatusError,
  InvitationAlreadyAcceptedError,
  InvitationAlreadyRevokedError,
  InvitationExpiredError,
  InvitationRevokedError,
} from "./invitation.errors";

export type InvitationWorkflowState = {
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
};

export type InvitationAccountState = {
  status: AccountStatusValue;
};

export function isInvitationExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt <= now;
}

export function isInvitationUsable(
  invitation: InvitationWorkflowState,
  account: InvitationAccountState | null,
  now: Date
): boolean {
  return (
    invitation.acceptedAt === null &&
    invitation.revokedAt === null &&
    !isInvitationExpired(invitation.expiresAt, now) &&
    account?.status === "INVITED"
  );
}

export function assertInvitationUsable(
  invitation: InvitationWorkflowState,
  account: InvitationAccountState | null,
  now: Date
): void {
  if (invitation.acceptedAt !== null) {
    throw new InvitationAlreadyAcceptedError();
  }
  if (invitation.revokedAt !== null) {
    throw new InvitationRevokedError();
  }
  if (isInvitationExpired(invitation.expiresAt, now)) {
    throw new InvitationExpiredError();
  }
  if (!account) {
    throw new InvitationAccountNotFoundError();
  }
  if (account.status !== "INVITED") {
    throw new InvitationAccountStatusError(account.status);
  }
}

export function assertCanAcceptInvitation(
  invitation: InvitationWorkflowState,
  account: InvitationAccountState | null,
  now: Date
): void {
  assertInvitationUsable(invitation, account, now);
}

export function isInvitationRevocable(invitation: InvitationWorkflowState): boolean {
  return invitation.acceptedAt === null && invitation.revokedAt === null;
}

export function assertCanRevokeInvitation(invitation: InvitationWorkflowState): void {
  if (invitation.acceptedAt !== null) {
    throw new InvitationAlreadyAcceptedError();
  }
  if (invitation.revokedAt !== null) {
    throw new InvitationAlreadyRevokedError();
  }
}

export function invitationsToRevokeBeforeIssue(
  invitations: readonly InvitationWorkflowState[]
): InvitationWorkflowState[] {
  return invitations.filter(isInvitationRevocable);
}
