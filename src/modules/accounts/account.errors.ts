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

export class InvalidAccountCreationError extends Error {
  constructor() {
    super("Initial account status and password hash are inconsistent");
    this.name = "InvalidAccountCreationError";
  }
}

export class InvalidAccountEmailError extends Error {
  constructor() {
    super("Account email cannot be empty after normalization");
    this.name = "InvalidAccountEmailError";
  }
}
