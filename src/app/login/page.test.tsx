import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AccountLoginPage, { metadata } from "./page";

describe("account login page", () => {
  it("publishes noindex, nofollow, and no-referrer metadata", () => {
    expect(metadata).toMatchObject({
      referrer: "no-referrer",
      robots: {
        index: false,
        follow: false,
      },
    });
  });

  it("renders an accessible POST form without sensitive data", () => {
    const html = renderToStaticMarkup(<AccountLoginPage />);

    expect(html).toContain('action="/api/account-login"');
    expect(html).toContain('method="post"');
    expect(html).toContain('autoComplete="email"');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain("Correo electrónico");
    expect(html).toContain('href="/account/password-recovery"');
    expect(html).toContain("¿Olvidaste tu contraseña?");
    expect(html).not.toContain('href="/admin/login"');
    expect(html).not.toContain('href="/contact"');
    expect(html).not.toContain("passwordHash");
    expect(html).not.toContain("tpg_account_session");
    expect(html).not.toContain("token=");
  });
});
