import { isIP } from "node:net";

export type TrustedClientIpHeader =
  | "none"
  | "cf-connecting-ip"
  | "x-forwarded-for";

export function resolveTrustedClientIp(
  headers: Headers,
  trustedHeader: TrustedClientIpHeader
): string | null {
  if (trustedHeader === "none") {
    return null;
  }

  const raw = headers.get(trustedHeader);
  const candidate =
    trustedHeader === "x-forwarded-for"
      ? raw?.split(",")[0]?.trim()
      : raw?.trim();
  return candidate && isIP(candidate) ? candidate : null;
}
