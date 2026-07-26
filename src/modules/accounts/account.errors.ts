import type { AccountStatusValue } from "./account.types";

export class InvalidAccountTransitionError extends Error {
  constructor(current: AccountStatusValue, next: AccountStatusValue) {
    super(`Cannot transition account from ${current} to ${next}`);
    this.name = "InvalidAccountTransitionError";
  }
}

export class AccountLoginNotAllowedError extends Error {
  constructor(status: AccountStatusValue) {
    super(`Account in ${status} cannot log in`);
    this.name = "AccountLoginNotAllowedError";
  }
}

export class AccountInvitationNotAllowedError extends Error {
  constructor(status: AccountStatusValue) {
    super(`Account in ${status} cannot receive an invitation`);
    this.name = "AccountInvitationNotAllowedError";
  }
}

export class AccountNotFoundError extends Error {
  constructor() {
    super("Account not found");
    this.name = "AccountNotFoundError";
  }
}

export class AccountInactiveError extends Error {
  constructor() {
    super("Account is inactive");
    this.name = "AccountInactiveError";
  }
}

export class AccountLockedError extends Error {
  constructor() {
    super("Account is locked");
    this.name = "AccountLockedError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid credentials");
    this.name = "InvalidCredentialsError";
  }
}

export class InvalidAccountCreationError extends Error {
  constructor() {
    super("Initial account status and password hash are inconsistent");
    this.name = "InvalidAccountCreationError";
  }
}

export class InvalidAccountPolicyError extends Error {
  constructor() {
    super("Account policy configuration is invalid");
    this.name = "InvalidAccountPolicyError";
  }
}

export class InvalidAccountEmailError extends Error {
  constructor() {
    super("Account email is invalid or non-canonical");
    this.name = "InvalidAccountEmailError";
  }
}
