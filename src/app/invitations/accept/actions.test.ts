import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  InvitationAlreadyAcceptedError,
} from "@/modules/invitations/invitation.errors";

const mocks = vi.hoisted(() => ({
  accept: vi.fn(),
  isAvailable: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/modules/invitations/invitation-acceptance", () => ({
  acceptAccountInvitation: mocks.accept,
  isInvitationAvailable: mocks.isAvailable,
}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

import {
  acceptInvitationAction,
  inspectInvitationAction,
} from "./actions";

const token = "A".repeat(43);
const initialState = { status: "available" as const };

function form(password: string, confirmation = password) {
  const formData = new FormData();
  formData.set("password", password);
  formData.set("passwordConfirmation", confirmation);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.redirect.mockImplementation((path: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { path });
  });
});

describe("invitation acceptance action", () => {
  it.each([
    [true, { status: "available" }],
    [false, { status: "unavailable" }],
  ] as const)(
    "returns one minimal inspection state when availability is %s",
    async (available, expected) => {
      mocks.isAvailable.mockResolvedValueOnce(available);

      await expect(inspectInvitationAction(token)).resolves.toEqual(expected);
      expect(mocks.redirect).not.toHaveBeenCalled();
    }
  );

  it("returns a mismatched confirmation without redirecting or touching the service", async () => {
    await expect(
      acceptInvitationAction(
        token,
        initialState,
        form("a-secure-password", "different-password")
      )
    ).resolves.toEqual({
      status: "available",
      error: "mismatch",
    });
    expect(mocks.accept).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("activates the account and redirects to a token-free success route", async () => {
    mocks.accept.mockResolvedValueOnce({ status: "ACTIVE" });

    await expect(
      acceptInvitationAction(token, initialState, form("a-secure-password"))
    ).rejects.toMatchObject({ path: "/invitations/accepted" });
    expect(mocks.accept).toHaveBeenCalledWith({
      token,
      password: "a-secure-password",
    });
  });

  it("maps consumed and otherwise unusable invitations to one state without redirecting", async () => {
    mocks.accept.mockRejectedValueOnce(new InvitationAlreadyAcceptedError());

    await expect(
      acceptInvitationAction(token, initialState, form("a-secure-password"))
    ).resolves.toEqual({
      status: "unavailable",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("does not hide unexpected persistence failures", async () => {
    const failure = new Error("database unavailable");
    mocks.accept.mockRejectedValueOnce(failure);

    await expect(
      acceptInvitationAction(token, initialState, form("a-secure-password"))
    ).rejects.toBe(failure);
  });
});
