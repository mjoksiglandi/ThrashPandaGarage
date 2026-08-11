import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const mocks = vi.hoisted(() => ({
  createMailTransport: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    APP_BASE_URL: "https://trashpanda.example/base",
    MAIL_FROM: "Trashpanda <mail@example.com>",
  },
}));
vi.mock("./mail-transport", () => ({
  createMailTransport: mocks.createMailTransport,
}));

import {
  ACCOUNT_INVITATION_EMAIL_SUBJECT,
  accountInvitationEmailText,
  accountInvitationUrl,
  sendAccountInvitationEmail,
} from "./account-invitation-mail";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createMailTransport.mockReturnValue({ sendMail: mocks.sendMail });
  mocks.sendMail.mockResolvedValue({ messageId: "message-1" });
});

describe("account invitation mail", () => {
  it("builds the Slice 1 fragment URL without placing the token in the query", () => {
    const url = accountInvitationUrl(
      "https://trashpanda.example/base",
      "opaque_token-value"
    );
    expect(url).toBe(
      "https://trashpanda.example/invitations/accept#opaque_token-value"
    );
    expect(new URL(url).search).toBe("");
  });

  it("sends the raw token only through the invitation email", async () => {
    const token = "opaque_token-value";
    const digest = createHash("sha256").update(token).digest("hex");

    await sendAccountInvitationEmail({
      to: "person@example.test",
      token,
      expiresInDays: 7,
    });

    const message = mocks.sendMail.mock.calls[0][0];
    expect(message).toEqual({
      from: "Trashpanda <mail@example.com>",
      to: "person@example.test",
      subject: ACCOUNT_INVITATION_EMAIL_SUBJECT,
      text: accountInvitationEmailText({
        invitationUrl:
          "https://trashpanda.example/invitations/accept#opaque_token-value",
        expiresInDays: 7,
      }),
    });
    expect(message.text).toContain("expira en 7 días");
    expect(message.text).toContain("#opaque_token-value");
    expect(message.text).not.toContain("?token=");
    expect(message.text).not.toContain(digest);
  });
});
