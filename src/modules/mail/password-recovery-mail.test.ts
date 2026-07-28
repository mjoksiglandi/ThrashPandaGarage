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
  PASSWORD_RECOVERY_EMAIL_SUBJECT,
  passwordRecoveryEmailText,
  passwordRecoveryUrl,
  sendPasswordRecoveryEmail,
} from "./password-recovery-mail";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createMailTransport.mockReturnValue({
    sendMail: mocks.sendMail,
  });
  mocks.sendMail.mockResolvedValue({ messageId: "message-1" });
});

describe("password recovery mail", () => {
  it("builds a fragment URL without placing the token in the query", () => {
    const url = passwordRecoveryUrl(
      "https://trashpanda.example/base",
      "opaque_token-value"
    );
    expect(url).toBe(
      "https://trashpanda.example/account/password-reset#token=opaque_token-value"
    );
    expect(new URL(url).search).toBe("");
  });

  it("sends the configured message with the token only in the email", async () => {
    const token = "opaque_token-value";
    const digest = createHash("sha256").update(token).digest("hex");

    await sendPasswordRecoveryEmail({
      to: "person@example.test",
      token,
      expiresInMinutes: 60,
    });

    const message = mocks.sendMail.mock.calls[0][0];
    expect(message).toEqual({
      from: "Trashpanda <mail@example.com>",
      to: "person@example.test",
      subject: PASSWORD_RECOVERY_EMAIL_SUBJECT,
      text: passwordRecoveryEmailText({
        recoveryUrl:
          "https://trashpanda.example/account/password-reset#token=opaque_token-value",
        expiresInMinutes: 60,
      }),
    });
    expect(message.text).toContain("expira en 60 minutos");
    expect(message.text).toContain("Si no solicitaste");
    expect(message.text).toContain("#token=opaque_token-value");
    expect(message.text).not.toContain("?token=");
    expect(message.text).not.toContain(digest);
  });
});
