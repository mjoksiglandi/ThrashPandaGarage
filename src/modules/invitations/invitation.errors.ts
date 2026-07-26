import type { AccountStatusValue } from "@/modules/accounts/account.types";

export class InvitationNotFoundError extends Error {
  constructor() {
    super("Invitation not found");
    this.name = "InvitationNotFoundError";
  }
}

export class InvitationAlreadyAcceptedError extends Error {
  constructor() {
    super("Invitation has already been accepted");
    this.name = "InvitationAlreadyAcceptedError";
  }
}

export class InvitationRevokedError extends Error {
  constructor() {
    super("Invitation has been revoked");
    this.name = "InvitationRevokedError";
  }
}

export class InvitationAlreadyRevokedError extends Error {
  constructor() {
    super("Invitation has already been revoked");
    this.name = "InvitationAlreadyRevokedError";
  }
}

export class InvitationExpiredError extends Error {
  constructor() {
    super("Invitation has expired");
    this.name = "InvitationExpiredError";
  }
}

export class InvitationNotUsableError extends Error {
  constructor() {
    super("Invitation is not usable");
    this.name = "InvitationNotUsableError";
  }
}

export class InvitationAccountNotFoundError extends Error {
  constructor() {
    super("Invitation account not found");
    this.name = "InvitationAccountNotFoundError";
  }
}

export class InvitationAccountStatusError extends Error {
  constructor(status: AccountStatusValue) {
    super(`Account in ${status} cannot accept an invitation`);
    this.name = "InvitationAccountStatusError";
  }
}

export class InvalidPasswordHashError extends Error {
  constructor() {
    super("Password hash is invalid");
    this.name = "InvalidPasswordHashError";
  }
}

export class PasswordHashingError extends Error {
  constructor() {
    super("Password hashing failed");
    this.name = "PasswordHashingError";
  }
}
