export class AccountSessionNotFoundError extends Error {
  constructor() {
    super("Session not found");
    this.name = "AccountSessionNotFoundError";
  }
}

export class AccountSessionExpiredError extends Error {
  constructor() {
    super("Session has expired");
    this.name = "AccountSessionExpiredError";
  }
}

export class AccountSessionRevokedError extends Error {
  constructor() {
    super("Session has been revoked");
    this.name = "AccountSessionRevokedError";
  }
}
