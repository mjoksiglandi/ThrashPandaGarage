import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./PasswordResetClient", () => ({
  PasswordResetClient: vi.fn(() => null),
}));

import { PasswordResetClient } from "./PasswordResetClient";
import AccountPasswordResetPage, {
  dynamic,
  metadata,
  revalidate,
} from "./page";

describe("account password reset shell", () => {
  it("keeps the fragment in a client-only boundary", () => {
    const result = AccountPasswordResetPage();
    const section = result.props.children[3];
    const client = section.props.children[0];

    expect(client.type).toBe(PasswordResetClient);
    expect(renderToStaticMarkup(result)).not.toContain("token=");
  });

  it("prevents caching, referrer leakage, and search indexing", () => {
    expect(metadata).toMatchObject({
      referrer: "no-referrer",
      robots: {
        index: false,
        follow: false,
      },
    });
    expect(dynamic).toBe("force-dynamic");
    expect(revalidate).toBe(0);
  });

  it("offers a new recovery request instead of sending the user to contact", () => {
    const html = renderToStaticMarkup(<AccountPasswordResetPage />);

    expect(html).toContain('href="/account/password-recovery"');
    expect(html).toContain("Solicitar un nuevo enlace");
    expect(html).not.toContain('href="/contact"');
  });
});
