import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  MAX_BULK_CLIENT_INVITATIONS,
  BulkClientInvitationSelectionError,
  createBulkClientInvitationService,
} from "./bulk-client-invitations";

const findClients = vi.fn();
const createAndInvite = vi.fn();
const resend = vi.fn();
const service = createBulkClientInvitationService({ findClients, createAndInvite, resend });

const candidate = (
  id: string,
  account: { status: "INVITED" | "ACTIVE" | "LOCKED" | "DISABLED" } | null = null,
  email: string | null = `${id}@example.test`
) => ({ id, name: `Cliente ${id}`, email, account });

beforeEach(() => {
  vi.clearAllMocks();
  createAndInvite.mockResolvedValue(undefined);
  resend.mockResolvedValue(undefined);
});

describe("bulk client invitations", () => {
  it.each([
    ["empty", [], "Selecciona al menos"],
    ["invalid", ["not valid"], "no es válida"],
    ["duplicate", ["client-1", "client-1"], "duplicados"],
    ["over limit", Array.from({ length: MAX_BULK_CLIENT_INVITATIONS + 1 }, (_, index) => `client-${index}`), "hasta 25"],
  ])("rejects %s selections before reading clients", async (_label, clientIds, message) => {
    await expect(service({ clientIds, actorId: "admin-1" })).rejects.toThrow(message);
    expect(findClients).not.toHaveBeenCalled();
  });

  it("rejects unknown IDs without processing any known client", async () => {
    findClients.mockResolvedValue([candidate("client-1")]);

    await expect(
      service({ clientIds: ["client-1", "client-unknown"], actorId: "admin-1" })
    ).rejects.toBeInstanceOf(BulkClientInvitationSelectionError);

    expect(createAndInvite).not.toHaveBeenCalled();
    expect(resend).not.toHaveBeenCalled();
  });

  it("returns one ordered result for eligible, invited, active, and email-less clients", async () => {
    findClients.mockResolvedValue([
      candidate("client-active", { status: "ACTIVE" }),
      candidate("client-new"),
      candidate("client-invited", { status: "INVITED" }),
      candidate("client-no-email", null, null),
    ]);

    const result = await service({
      clientIds: ["client-new", "client-invited", "client-active", "client-no-email"],
      actorId: "admin-1",
    });

    expect(result.items.map((item) => item.outcome)).toEqual([
      "INVITED",
      "RESENT",
      "SKIPPED_ACTIVE",
      "SKIPPED_NO_EMAIL",
    ]);
    expect(result).toMatchObject({ invited: 1, resent: 1, skipped: 2, failed: 0 });
    expect(createAndInvite).toHaveBeenCalledWith({ clientId: "client-new", actorId: "admin-1" });
    expect(resend).toHaveBeenCalledWith({ clientId: "client-invited", actorId: "admin-1" });
  });

  it("continues after a partial failure and reports it per client", async () => {
    findClients.mockResolvedValue([
      candidate("client-fails"),
      candidate("client-invited", { status: "INVITED" }),
    ]);
    createAndInvite.mockRejectedValueOnce(new Error("SMTP unavailable"));

    const result = await service({
      clientIds: ["client-fails", "client-invited"],
      actorId: "admin-1",
    });

    expect(result.items.map((item) => item.outcome)).toEqual(["FAILED", "RESENT"]);
    expect(result).toMatchObject({ invited: 0, resent: 1, skipped: 0, failed: 1 });
  });

  it("never runs more than three invitation operations concurrently", async () => {
    const clients = Array.from({ length: 8 }, (_, index) => candidate(`client-${index}`));
    findClients.mockResolvedValue(clients);
    let active = 0;
    let peak = 0;
    createAndInvite.mockImplementation(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
    });

    await service({ clientIds: clients.map((client) => client.id), actorId: "admin-1" });

    expect(peak).toBe(3);
  });

  it("retries a previously created invited account through the canonical resend path", async () => {
    findClients
      .mockResolvedValueOnce([candidate("client-1")])
      .mockResolvedValueOnce([candidate("client-1", { status: "INVITED" })]);

    await service({ clientIds: ["client-1"], actorId: "admin-1" });
    const retry = await service({ clientIds: ["client-1"], actorId: "admin-1" });

    expect(createAndInvite).toHaveBeenCalledOnce();
    expect(resend).toHaveBeenCalledOnce();
    expect(retry.items[0].outcome).toBe("RESENT");
  });
});
