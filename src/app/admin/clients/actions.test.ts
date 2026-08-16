import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  bulkInviteClients: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/modules/accounts/bulk-client-invitations", () => {
  class BulkClientInvitationSelectionError extends Error {}
  return {
    BulkClientInvitationSelectionError,
    bulkInviteClients: mocks.bulkInviteClients,
  };
});

import { BulkClientInvitationSelectionError } from "@/modules/accounts/bulk-client-invitations";
import { inviteSelectedClients } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ id: "admin-1", email: "admin@example.test", role: "ADMIN" });
  mocks.bulkInviteClients.mockResolvedValue({ items: [], invited: 0, resent: 0, skipped: 0, failed: 0 });
});

function form(...ids: string[]) {
  const data = new FormData();
  ids.forEach((id) => data.append("clientIds", id));
  return data;
}

describe("inviteSelectedClients", () => {
  it.each(["unauthenticated", "authenticated non-admin"])(
    "does no administrative I/O for an %s request",
    async (reason) => {
      mocks.requireAdmin.mockRejectedValueOnce(new Error(reason));

      await expect(inviteSelectedClients({ status: "idle" }, form("client-1"))).rejects.toThrow(reason);

      expect(mocks.bulkInviteClients).not.toHaveBeenCalled();
    }
  );

  it("authenticates before invoking the bulk service", async () => {
    await inviteSelectedClients({ status: "idle" }, form("client-1"));

    expect(mocks.requireAdmin.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.bulkInviteClients.mock.invocationCallOrder[0]
    );
    expect(mocks.bulkInviteClients).toHaveBeenCalledWith({
      clientIds: ["client-1"],
      actorId: "admin-1",
    });
  });

  it("returns safe validation feedback", async () => {
    mocks.bulkInviteClients.mockRejectedValueOnce(
      new BulkClientInvitationSelectionError("Selecciona al menos un cliente.")
    );

    await expect(inviteSelectedClients({ status: "idle" }, form())).resolves.toEqual({
      status: "validation-error",
      message: "Selecciona al menos un cliente.",
    });
  });
});
