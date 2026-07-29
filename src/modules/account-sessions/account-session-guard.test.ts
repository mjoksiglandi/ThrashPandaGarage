import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("./current-account-session", () => ({
  resolveCurrentAccountSession: mocks.resolve,
}));

import {
  AccountAuthenticationRequiredError,
} from "./account-session-http";
import { requireAccountSession } from "./account-session-guard";

describe("account session guard", () => {
  it("uses the canonical current-session resolver", async () => {
    const principal = {
      sessionId: "session-1",
      accountId: "account-1",
      clientId: "client-1",
      email: "person@example.test",
    };
    mocks.resolve.mockResolvedValueOnce({
      kind: "authenticated",
      principal,
    });

    await expect(requireAccountSession()).resolves.toEqual(principal);
    expect(mocks.resolve).toHaveBeenCalledOnce();
  });

  it("rejects an unauthenticated resolution with the shared 401 error", async () => {
    mocks.resolve.mockResolvedValueOnce({ kind: "unauthenticated" });

    await expect(requireAccountSession()).rejects.toBeInstanceOf(
      AccountAuthenticationRequiredError
    );
  });
});
