"use server";

import { redirect } from "next/navigation";
import { InvalidCredentialsError } from "@/modules/accounts/account.errors";
import { InvalidTokenError } from "@/modules/accounts/secure-token";
import {
  acceptAccountInvitation,
} from "@/modules/invitations/invitation-acceptance";
import {
  InvalidPasswordHashError,
  InvitationAccountNotFoundError,
  InvitationAccountStatusError,
  InvitationAlreadyAcceptedError,
  InvitationExpiredError,
  InvitationNotFoundError,
  InvitationRevokedError,
  PasswordHashingError,
} from "@/modules/invitations/invitation.errors";

export type InvitationAcceptanceActionState = {
  status: "available" | "unavailable";
  error?: "mismatch" | "password" | "temporary";
};

const unavailableErrors = [
  InvalidTokenError,
  InvitationNotFoundError,
  InvitationAlreadyAcceptedError,
  InvitationRevokedError,
  InvitationExpiredError,
  InvitationAccountNotFoundError,
  InvitationAccountStatusError,
];

export async function inspectInvitationAction(
  token: string
): Promise<InvitationAcceptanceActionState> {
  const { isInvitationAvailable } =
    await import("@/modules/invitations/invitation-acceptance");
  return {
    status: (await isInvitationAvailable(token))
      ? "available"
      : "unavailable",
  };
}

export async function acceptInvitationAction(
  token: string,
  _previousState: InvitationAcceptanceActionState,
  formData: FormData
): Promise<InvitationAcceptanceActionState> {
  const password = formData.get("password");
  const confirmation = formData.get("passwordConfirmation");

  if (typeof password !== "string" || password !== confirmation) {
    return { status: "available", error: "mismatch" };
  }

  try {
    await acceptAccountInvitation({ token, password });
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      return { status: "available", error: "password" };
    }
    if (unavailableErrors.some((ErrorType) => error instanceof ErrorType)) {
      return { status: "unavailable" };
    }
    if (
      error instanceof PasswordHashingError ||
      error instanceof InvalidPasswordHashError
    ) {
      return { status: "available", error: "temporary" };
    }
    throw error;
  }

  redirect("/invitations/accepted");
}
