import crypto from "crypto";

export function signSessionValue(userId: string, secret: string): string {
  const signature = crypto.createHmac("sha256", secret).update(userId).digest("base64url");
  return `${userId}.${signature}`;
}

export function verifySessionValue(rawValue: string | undefined, secret: string): string | null {
  if (!rawValue) return null;
  const separatorIndex = rawValue.lastIndexOf(".");
  if (separatorIndex === -1) return null;

  const userId = rawValue.slice(0, separatorIndex);
  const signature = rawValue.slice(separatorIndex + 1);
  const expectedSignature = crypto.createHmac("sha256", secret).update(userId).digest("base64url");

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  return userId;
}
