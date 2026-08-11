import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ submitContactMessage: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/modules/contact/contact.service", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/modules/contact/contact.service")
  >();
  return { ...actual, submitContactMessage: mocks.submitContactMessage };
});

import {
  ContactRateLimitError,
  InvalidContactSubmissionError,
} from "@/modules/contact/contact.service";
import { CONTACT_SENT_MESSAGE } from "@/modules/contact/contact-http";
import { POST } from "./route";

function request(body: string, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.submitContactMessage.mockResolvedValue(undefined);
});

describe("POST /api/contact", () => {
  it("awaits delivery and returns sent only after success", async () => {
    const body = {
      name: "Ada Lovelace",
      email: "ada@example.test",
      sessionType: "",
      message: "Quiero coordinar una sesión.",
      website: "",
    };
    const response = await POST(request(JSON.stringify(body), {
      "x-forwarded-for": "203.0.113.30",
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      message: CONTACT_SENT_MESSAGE,
    });
    expect(mocks.submitContactMessage).toHaveBeenCalledWith({ body, origin: null });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 400 for invalid JSON and validation failures", async () => {
    expect((await POST(request("{"))).status).toBe(400);

    mocks.submitContactMessage.mockRejectedValueOnce(
      new InvalidContactSubmissionError()
    );
    expect((await POST(request(JSON.stringify({})))).status).toBe(400);
  });

  it("returns 429 when the limiter rejects the submission", async () => {
    mocks.submitContactMessage.mockRejectedValueOnce(new ContactRateLimitError());
    const response = await POST(request(JSON.stringify({})));
    expect(response.status).toBe(429);
  });

  it("returns 503 instead of claiming success when SMTP fails", async () => {
    mocks.submitContactMessage.mockRejectedValueOnce(new Error("SMTP unavailable"));
    const response = await POST(request(JSON.stringify({})));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false });
  });

  it("rejects oversized bodies before parsing or delivery", async () => {
    const response = await POST(request("{}", { "content-length": "16385" }));
    expect(response.status).toBe(400);
    expect(mocks.submitContactMessage).not.toHaveBeenCalled();
  });
});
