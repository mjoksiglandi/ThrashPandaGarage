import { describe, expect, it } from "vitest";
import {
  InvitationAccountNotFoundError,
  InvitationAccountStatusError,
  InvitationAlreadyAcceptedError,
  InvitationAlreadyRevokedError,
  InvitationExpiredError,
  InvitationRevokedError,
} from "./invitation.errors";
import {
  assertCanAcceptInvitation,
  assertCanRevokeInvitation,
  assertInvitationUsable,
  invitationsToRevokeBeforeIssue,
  isInvitationExpired,
  isInvitationRevocable,
  isInvitationUsable,
} from "./invitation-workflow";

const now = new Date("2026-07-25T12:00:00.000Z");
const usableInvitation = {
  acceptedAt: null,
  revokedAt: null,
  expiresAt: new Date("2026-07-25T12:00:01.000Z"),
};
const invitedAccount = { status: "INVITED" as const };

describe("invitation usability policy", () => {
  it("allows an unconsumed, unrevoked and non-expired invitation for an INVITED account", () => {
    expect(isInvitationUsable(usableInvitation, invitedAccount, now)).toBe(true);
    expect(() =>
      assertCanAcceptInvitation(usableInvitation, invitedAccount, now)
    ).not.toThrow();
  });

  it("rejects an accepted invitation", () => {
    const invitation = { ...usableInvitation, acceptedAt: now };
    expect(isInvitationUsable(invitation, invitedAccount, now)).toBe(false);
    expect(() => assertInvitationUsable(invitation, invitedAccount, now)).toThrow(
      InvitationAlreadyAcceptedError
    );
  });

  it("rejects a revoked invitation", () => {
    const invitation = { ...usableInvitation, revokedAt: now };
    expect(isInvitationUsable(invitation, invitedAccount, now)).toBe(false);
    expect(() => assertInvitationUsable(invitation, invitedAccount, now)).toThrow(
      InvitationRevokedError
    );
  });

  it("rejects an invitation that expired before now", () => {
    const invitation = {
      ...usableInvitation,
      expiresAt: new Date("2026-07-25T11:59:59.000Z"),
    };
    expect(isInvitationUsable(invitation, invitedAccount, now)).toBe(false);
    expect(() => assertInvitationUsable(invitation, invitedAccount, now)).toThrow(
      InvitationExpiredError
    );
  });

  it("treats expiresAt equal to now as expired", () => {
    const invitation = { ...usableInvitation, expiresAt: now };
    expect(isInvitationExpired(invitation.expiresAt, now)).toBe(true);
    expect(isInvitationUsable(invitation, invitedAccount, now)).toBe(false);
  });

  it("rejects acceptance for an ACTIVE account", () => {
    expect(() =>
      assertCanAcceptInvitation(usableInvitation, { status: "ACTIVE" }, now)
    ).toThrow(InvitationAccountStatusError);
  });

  it("rejects acceptance when the account no longer exists", () => {
    expect(isInvitationUsable(usableInvitation, null, now)).toBe(false);
    expect(() =>
      assertCanAcceptInvitation(usableInvitation, null, now)
    ).toThrow(InvitationAccountNotFoundError);
  });

  it("rejects acceptance for a LOCKED account", () => {
    expect(() =>
      assertCanAcceptInvitation(usableInvitation, { status: "LOCKED" }, now)
    ).toThrow(InvitationAccountStatusError);
  });

  it("rejects acceptance for a DISABLED account", () => {
    expect(() =>
      assertCanAcceptInvitation(usableInvitation, { status: "DISABLED" }, now)
    ).toThrow(InvitationAccountStatusError);
  });

  it("does not mutate the invitation or account", () => {
    const invitation = { ...usableInvitation };
    const account = { ...invitedAccount };
    const invitationSnapshot = { ...invitation };
    const accountSnapshot = { ...account };

    isInvitationUsable(invitation, account, now);
    assertInvitationUsable(invitation, account, now);

    expect(invitation).toEqual(invitationSnapshot);
    expect(account).toEqual(accountSnapshot);
  });
});

describe("invitation revocation policy", () => {
  it("allows revoking an unused invitation, including an expired one", () => {
    const expired = {
      ...usableInvitation,
      expiresAt: new Date("2026-07-25T11:59:59.000Z"),
    };

    expect(isInvitationRevocable(usableInvitation)).toBe(true);
    expect(isInvitationRevocable(expired)).toBe(true);
    expect(() => assertCanRevokeInvitation(expired)).not.toThrow();
  });

  it("rejects repeated revocation", () => {
    const revoked = { ...usableInvitation, revokedAt: now };
    expect(isInvitationRevocable(revoked)).toBe(false);
    expect(() => assertCanRevokeInvitation(revoked)).toThrow(
      InvitationAlreadyRevokedError
    );
  });

  it("rejects revoking an already accepted invitation", () => {
    const accepted = { ...usableInvitation, acceptedAt: now };
    expect(isInvitationRevocable(accepted)).toBe(false);
    expect(() => assertCanRevokeInvitation(accepted)).toThrow(
      InvitationAlreadyAcceptedError
    );
  });

  it("selects every pending invitation for revocation before reissue", () => {
    const expired = {
      ...usableInvitation,
      expiresAt: new Date("2026-07-25T11:59:59.000Z"),
    };
    const revoked = { ...usableInvitation, revokedAt: now };
    const accepted = { ...usableInvitation, acceptedAt: now };
    const invitations = [usableInvitation, expired, revoked, accepted];
    const snapshot = invitations.map((invitation) => ({ ...invitation }));

    expect(invitationsToRevokeBeforeIssue(invitations)).toEqual([
      usableInvitation,
      expired,
    ]);
    expect(invitations).toEqual(snapshot);
  });
});
