import { GalleryEventActorType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type { AccountSessionPrincipal } from "@/modules/account-sessions/current-account-session.service";
import { accountGalleryEventActor } from "./gallery-event-actor";

const principal: AccountSessionPrincipal = {
  sessionId: "session-1",
  accountId: "account-1",
  clientId: "client-1",
  email: "account@example.test",
};

describe("gallery event actors", () => {
  it("keeps every existing actor type and adds ACCOUNT", () => {
    expect(GalleryEventActorType).toMatchObject({
      ADMIN: "ADMIN",
      ACCOUNT: "ACCOUNT",
      GALLERY_TOKEN: "GALLERY_TOKEN",
      SYSTEM: "SYSTEM",
    });
  });

  it("attributes an authenticated action to the stable account id", () => {
    expect(
      accountGalleryEventActor({
        ...principal,
        sessionId: "session-controlled-value",
        clientId: "client-controlled-value",
        requestedAccountId: "forged-account-id",
      } as AccountSessionPrincipal & { requestedAccountId: string })
    ).toEqual({
      actorType: "ACCOUNT",
      actorId: "account-1",
    });
  });

  it("requires a non-empty account id", () => {
    expect(() =>
      accountGalleryEventActor({ ...principal, accountId: " " })
    ).toThrow("Account actorId is required");
  });
});
