import { createHash } from "node:crypto";

declare const tokenHashBrand: unique symbol;

export type TokenHash = string & { readonly [tokenHashBrand]: true };

const TOKEN_HASH_PATTERN = /^[a-f0-9]{64}$/;

export class InvalidTokenHashError extends Error {
  constructor() {
    super("Token hash must be a lowercase SHA-256 hex digest");
    this.name = "InvalidTokenHashError";
  }
}

export function isTokenHash(value: string): value is TokenHash {
  return TOKEN_HASH_PATTERN.test(value);
}

export function assertTokenHash(value: string): asserts value is TokenHash {
  if (!isTokenHash(value)) {
    throw new InvalidTokenHashError();
  }
}

export function hashOpaqueToken(token: string): TokenHash {
  return createHash("sha256").update(token).digest("hex") as TokenHash;
}
