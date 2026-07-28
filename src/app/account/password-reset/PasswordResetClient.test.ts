import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  capturePasswordResetToken,
  validatePasswordResetForm,
} from "./PasswordResetClient";

const token = "A".repeat(43);

describe("password reset browser boundary", () => {
  it("captures the fragment token and immediately replaces history with the safe path", () => {
    const replaceState = vi.fn();

    expect(
      capturePasswordResetToken(
        {
          hash: `#token=${token}`,
          pathname: "/account/password-reset",
        } as Location,
        { replaceState } as unknown as History
      )
    ).toBe(token);
    expect(replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/account/password-reset"
    );
  });

  it.each([
    ["missing", ""],
    ["empty", "#token="],
    ["malformed", "#token=not-valid"],
    ["wrong field", `#other=${token}`],
  ])("cleans and rejects a %s fragment", (_label, hash) => {
    const replaceState = vi.fn();

    expect(
      capturePasswordResetToken(
        {
          hash,
          pathname: "/account/password-reset",
        } as Location,
        { replaceState } as unknown as History
      )
    ).toBeNull();
    expect(replaceState).toHaveBeenCalledOnce();
  });

  it("validates confirmation and the exact UTF-8 byte boundary", () => {
    expect(validatePasswordResetForm("a".repeat(72), "a".repeat(72))).toBeNull();
    expect(validatePasswordResetForm("é".repeat(36), "é".repeat(36))).toBeNull();
    expect(validatePasswordResetForm("a".repeat(73), "a".repeat(73))).toBe(
      "password"
    );
    expect(
      validatePasswordResetForm(`${"é".repeat(35)}abc`, `${"é".repeat(35)}abc`)
    ).toBe("password");
    expect(validatePasswordResetForm("valid-password", "different")).toBe(
      "mismatch"
    );
  });

  it("never persists, logs, redirects, or submits credentials with cookies", () => {
    const source = readFileSync(
      new URL("./PasswordResetClient.tsx", import.meta.url),
      "utf8"
    );

    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("document.cookie");
    expect(source).not.toContain("console.");
    expect(source).not.toContain("window.location.assign");
    expect(source).toContain('credentials: "omit"');
    expect(source).toContain("tokenRef.current = null");
  });
});
