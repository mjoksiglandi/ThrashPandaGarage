import "server-only";

import bcrypt from "bcryptjs";
import type { TokenHash } from "@/lib/token-hash";
import { createPrismaAccountServiceStore } from "@/modules/accounts/account-service.repository";
import {
  InvalidTokenError,
  sha256TokenHasher,
} from "@/modules/accounts/secure-token";
import { invitationRepository } from "./invitation.repository";
import {
  createInvitationAcceptanceService,
} from "./invitation.service";
import { isInvitationUsable } from "./invitation-workflow";

const invalidLookupHash = "0".repeat(64) as TokenHash;

const acceptanceService = createInvitationAcceptanceService({
  store: createPrismaAccountServiceStore(),
  clock: { now: () => new Date() },
  tokenHasher: sha256TokenHasher,
  passwordHasher: {
    hash: (password) => bcrypt.hash(password, 12),
    verify: (password, passwordHash) => bcrypt.compare(password, passwordHash),
  },
});

export async function isInvitationAvailable(
  token: string,
  now = new Date()
): Promise<boolean> {
  let structurallyValid = true;
  let tokenHash = invalidLookupHash;
  try {
    tokenHash = sha256TokenHasher.digest(token);
  } catch (error) {
    if (error instanceof InvalidTokenError) {
      structurallyValid = false;
    } else {
      throw error;
    }
  }

  const invitation = await invitationRepository.findByTokenHash(tokenHash);
  return Boolean(
    structurallyValid &&
      invitation &&
      isInvitationUsable(invitation, invitation.account, now)
  );
}

export function acceptAccountInvitation(input: {
  token: string;
  password: string;
}) {
  return acceptanceService.accept(input);
}
