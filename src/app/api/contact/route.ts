import { NextRequest, NextResponse } from "next/server";
import { resolveTrustedClientIp } from "@/lib/client-origin";
import { env } from "@/lib/env";
import {
  CONTACT_INVALID_MESSAGE,
  CONTACT_RATE_LIMIT_MESSAGE,
  CONTACT_SENT_MESSAGE,
  CONTACT_TEMPORARY_MESSAGE,
} from "@/modules/contact/contact-http";
import {
  ContactRateLimitError,
  InvalidContactSubmissionError,
  submitContactMessage,
} from "@/modules/contact/contact.service";

const MAX_BODY_BYTES = 16_384;

function response(
  body: { ok: boolean; message?: string; error?: string },
  status: number
) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return response({ ok: false, error: CONTACT_INVALID_MESSAGE }, 400);
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return response({ ok: false, error: CONTACT_INVALID_MESSAGE }, 400);
    }
    body = JSON.parse(rawBody);
  } catch {
    return response({ ok: false, error: CONTACT_INVALID_MESSAGE }, 400);
  }

  try {
    await submitContactMessage({
      body,
      origin: resolveTrustedClientIp(
        request.headers,
        env.TRUSTED_CLIENT_IP_HEADER
      ),
    });
    return response({ ok: true, message: CONTACT_SENT_MESSAGE }, 201);
  } catch (error) {
    if (error instanceof InvalidContactSubmissionError) {
      return response({ ok: false, error: CONTACT_INVALID_MESSAGE }, 400);
    }
    if (error instanceof ContactRateLimitError) {
      return response({ ok: false, error: CONTACT_RATE_LIMIT_MESSAGE }, 429);
    }
    return response({ ok: false, error: CONTACT_TEMPORARY_MESSAGE }, 503);
  }
}
