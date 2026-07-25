import { randomBytes } from "node:crypto";
import { hashOpaqueToken, type TokenHash } from "@/lib/token-hash";

export function hashInvitationToken(token: string): TokenHash {
  return hashOpaqueToken(token);
}

export function createInvitationToken(): { token: string; tokenHash: TokenHash } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInvitationToken(token) };
}
