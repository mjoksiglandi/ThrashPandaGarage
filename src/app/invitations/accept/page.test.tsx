import { describe, expect, it, vi } from "vitest";
import {
  ACCEPTANCE_PASSWORD_MAX_LENGTH,
  ACCEPTANCE_PASSWORD_MIN_LENGTH,
} from "@/modules/invitations/invitation.service";

vi.mock("./InvitationAcceptanceClient", () => ({
  InvitationAcceptanceClient: vi.fn(() => null),
}));

import InvitationAcceptancePage, { dynamic, metadata } from "./page";

describe("public invitation acceptance shell", () => {
  it("keeps invitation state in a client boundary instead of the route", () => {
    const result = InvitationAcceptancePage();
    const section = result.props.children[3];
    const client = section.props.children[0];

    expect(client.props).toEqual({
      minimumPasswordLength: ACCEPTANCE_PASSWORD_MIN_LENGTH,
      maximumPasswordLength: ACCEPTANCE_PASSWORD_MAX_LENGTH,
    });
  });

  it("prevents referrer leakage and search indexing", () => {
    expect(metadata).toMatchObject({
      referrer: "no-referrer",
      robots: {
        index: false,
        follow: false,
      },
    });
    expect(dynamic).toBe("force-dynamic");
  });
});
