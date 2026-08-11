import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createMailTransport: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: {
    SMTP_HOST: "smtp.example.test",
    MAIL_FROM: "Trashpanda <noreply@example.test>",
    CONTACT_EMAIL: "contact@example.test",
  },
}));
vi.mock("@/modules/mail/mail-transport", () => ({
  createMailTransport: mocks.createMailTransport,
}));

import {
  ContactRateLimitError,
  InvalidContactSubmissionError,
  parseContactSubmission,
  submitContactMessage,
} from "./contact.service";

function body(email: string, overrides: Record<string, unknown> = {}) {
  return {
    name: "Ada Lovelace",
    email,
    sessionType: "Retrato",
    message: "Quiero coordinar una sesión durante septiembre.",
    website: "",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createMailTransport.mockReturnValue({ sendMail: mocks.sendMail });
  mocks.sendMail.mockResolvedValue({ messageId: "message-1" });
});

describe("contact service", () => {
  it("normalizes a valid submission and keeps the session optional", () => {
    expect(parseContactSubmission(body(" PERSON@EXAMPLE.TEST ", {
      sessionType: "",
    }))).toMatchObject({
      name: "Ada Lovelace",
      email: "person@example.test",
      sessionType: "",
    });
  });

  it("rejects invalid or unexpected input", () => {
    expect(() => parseContactSubmission(body("not-an-email")))
      .toThrow(InvalidContactSubmissionError);
    expect(() => parseContactSubmission(body("valid@example.test", {
      admin: true,
    }))).toThrow(InvalidContactSubmissionError);
  });

  it("sends the message to the configured address with Reply-To", async () => {
    await submitContactMessage({
      body: body("reply@example.test"),
      origin: "203.0.113.20",
    });

    expect(mocks.sendMail).toHaveBeenCalledWith({
      from: "Trashpanda <noreply@example.test>",
      to: "contact@example.test",
      replyTo: "reply@example.test",
      subject: "Nueva consulta web — Retrato",
      text: expect.stringContaining("Ada Lovelace"),
    });
  });

  it("silently drops honeypot submissions", async () => {
    await submitContactMessage({
      body: body("bot@example.test", { website: "https://spam.example" }),
      origin: "203.0.113.21",
    });

    expect(mocks.createMailTransport).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("limits repeated submissions by normalized email", async () => {
    const input = { body: body("limited@example.test"), origin: null };
    await submitContactMessage(input);
    await submitContactMessage(input);
    await submitContactMessage(input);

    await expect(submitContactMessage(input)).rejects.toThrow(ContactRateLimitError);
    expect(mocks.sendMail).toHaveBeenCalledTimes(3);
  });
});
