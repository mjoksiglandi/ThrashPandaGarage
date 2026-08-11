import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  PASSWORD_RECOVERY_PUBLIC_MESSAGE,
  PASSWORD_RECOVERY_TEMPORARY_MESSAGE,
} from "@/modules/password-recovery/password-recovery-http";
import { submitPasswordRecoveryRequest } from "./PasswordRecoveryClient";

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("password recovery request browser boundary", () => {
  it("submits only the email without cookies and preserves the public message", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        { ok: true, message: PASSWORD_RECOVERY_PUBLIC_MESSAGE },
        202
      )
    );

    await expect(
      submitPasswordRecoveryRequest("person@example.test", fetcher)
    ).resolves.toEqual({
      status: "success",
      message: PASSWORD_RECOVERY_PUBLIC_MESSAGE,
    });
    expect(fetcher).toHaveBeenCalledWith("/api/account-password-recovery", {
      method: "POST",
      credentials: "omit",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: "person@example.test" }),
    });
  });

  it("uses one temporary result for server and network failures", async () => {
    const serverFailure = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ ok: false }, 500));
    const networkFailure = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("network"));
    const expected = {
      status: "error",
      message: PASSWORD_RECOVERY_TEMPORARY_MESSAGE,
    };

    await expect(
      submitPasswordRecoveryRequest("person@example.test", serverFailure)
    ).resolves.toEqual(expected);
    await expect(
      submitPasswordRecoveryRequest("person@example.test", networkFailure)
    ).resolves.toEqual(expected);
  });

  it("does not persist, log, or expose account lookup details", () => {
    const source = readFileSync(
      new URL("./PasswordRecoveryClient.tsx", import.meta.url),
      "utf8"
    );

    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("document.cookie");
    expect(source).not.toContain("console.");
    expect(source).not.toContain("passwordHash");
    expect(source).not.toContain("accountId");
    expect(source).not.toContain("token");
    expect(source).toContain('credentials: "omit"');
  });
});
