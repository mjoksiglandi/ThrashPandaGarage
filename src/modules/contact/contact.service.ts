import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { env } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { createMailTransport } from "@/modules/mail/mail-transport";
import {
  CONTACT_EMAIL_MAX_LENGTH,
  CONTACT_MESSAGE_MAX_LENGTH,
  CONTACT_MESSAGE_MIN_LENGTH,
  CONTACT_NAME_MAX_LENGTH,
  CONTACT_SESSION_TYPES,
} from "./contact-http";

const contactSchema = z.object({
  name: z.string().trim().min(2).max(CONTACT_NAME_MAX_LENGTH)
    .refine((value) => !/[\r\n]/.test(value)),
  email: z.string().trim().toLowerCase().email().max(CONTACT_EMAIL_MAX_LENGTH),
  sessionType: z.union([z.enum(CONTACT_SESSION_TYPES), z.literal("")]),
  message: z.string().trim()
    .min(CONTACT_MESSAGE_MIN_LENGTH)
    .max(CONTACT_MESSAGE_MAX_LENGTH),
  website: z.string().max(200).optional().default(""),
}).strict();

export type ContactSubmission = z.infer<typeof contactSchema>;

export class InvalidContactSubmissionError extends Error {}
export class ContactRateLimitError extends Error {}
export class ContactMailConfigurationError extends Error {}

const RATE_LIMIT = { email: 3, origin: 5, windowMs: 60 * 60 * 1_000 } as const;

function rateLimitKey(kind: "email" | "origin", value: string): string {
  const digest = createHash("sha256").update(value).digest("hex");
  return `contact:${kind}:${digest}`;
}

export function parseContactSubmission(body: unknown): ContactSubmission {
  const result = contactSchema.safeParse(body);
  if (!result.success) throw new InvalidContactSubmissionError();
  return result.data;
}

function assertWithinRateLimit(email: string, origin: string | null): void {
  // This matches the existing in-process limiter. Use shared storage before
  // horizontally scaling the application.
  const now = Date.now();
  const emailAllowed = checkRateLimit(
    rateLimitKey("email", email),
    RATE_LIMIT.email,
    RATE_LIMIT.windowMs,
    now
  );
  const originAllowed = origin === null || checkRateLimit(
    rateLimitKey("origin", origin),
    RATE_LIMIT.origin,
    RATE_LIMIT.windowMs,
    now
  );
  if (!emailAllowed || !originAllowed) throw new ContactRateLimitError();
}

export async function submitContactMessage(input: {
  body: unknown;
  origin: string | null;
}): Promise<void> {
  const submission = parseContactSubmission(input.body);

  // Keep the public response indistinguishable while silently dropping bots.
  if (submission.website) return;

  assertWithinRateLimit(submission.email, input.origin);
  if (!env.SMTP_HOST || !env.CONTACT_EMAIL) {
    throw new ContactMailConfigurationError();
  }

  const sessionLine = submission.sessionType || "No especificado";
  await createMailTransport().sendMail({
    from: env.MAIL_FROM,
    to: env.CONTACT_EMAIL,
    replyTo: submission.email,
    subject: `Nueva consulta web — ${sessionLine}`,
    text: [
      `Nombre: ${submission.name}`,
      `Email: ${submission.email}`,
      `Tipo de sesión: ${sessionLine}`,
      "",
      submission.message,
    ].join("\n"),
  });
}
