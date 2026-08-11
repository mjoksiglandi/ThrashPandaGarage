import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AccountPasswordRecoveryPage, { metadata } from "./page";

describe("account password recovery page", () => {
  it("publishes noindex, nofollow, and no-referrer metadata", () => {
    expect(metadata).toMatchObject({
      referrer: "no-referrer",
      robots: { index: false, follow: false },
    });
  });

  it("renders an accessible email form and a login return path", () => {
    const html = renderToStaticMarkup(<AccountPasswordRecoveryPage />);

    expect(html).toContain("Recupera tu acceso");
    expect(html).toContain('type="email"');
    expect(html).toContain('autoComplete="email"');
    expect(html).toContain('maxLength="254"');
    expect(html).toContain('href="/login"');
    expect(html).not.toContain('href="/contact"');
    expect(html).not.toContain("passwordHash");
    expect(html).not.toContain("token=");
  });
});
