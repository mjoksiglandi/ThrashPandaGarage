import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { TokenHash } from "@/lib/token-hash";

export class InvalidTokenError extends Error {
  constructor() {
    super("Invalid token");
    this.name = "InvalidTokenError";
  }
}

export interface OpaqueTokenGenerator {
  generate(): string;
}

export interface TokenHasher {
  digest(token: string): TokenHash;
  verify(token: string, expectedDigest: TokenHash): boolean;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, passwordHash: string): Promise<boolean>;
}

const OPAQUE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SHA256_DIGEST_PATTERN = /^[a-f0-9]{64}$/;

function assertOpaqueToken(token: unknown): asserts token is string {
  if (typeof token !== "string" || !OPAQUE_TOKEN_PATTERN.test(token)) {
    throw new InvalidTokenError();
  }
}

function assertSha256Digest(
  digest: unknown
): asserts digest is TokenHash {
  if (typeof digest !== "string" || !SHA256_DIGEST_PATTERN.test(digest)) {
    throw new InvalidTokenError();
  }
}

export const cryptoTokenGenerator: OpaqueTokenGenerator = {
  generate() {
    return randomBytes(32).toString("base64url");
  },
};

function digestToken(token: string): TokenHash {
  assertOpaqueToken(token);
  return createHash("sha256").update(token).digest("hex") as TokenHash;
}

export const sha256TokenHasher: TokenHasher = {
  digest: digestToken,
  verify(token, expectedDigest) {
    assertOpaqueToken(token);
    assertSha256Digest(expectedDigest);
    const actualDigest = createHash("sha256")
      .update(token)
      .digest("hex");
    const actual = Buffer.from(actualDigest, "hex");
    const expected = Buffer.from(expectedDigest, "hex");
    return timingSafeEqual(actual, expected);
  },
};
