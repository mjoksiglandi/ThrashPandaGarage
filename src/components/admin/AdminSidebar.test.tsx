import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pathname: "/admin" }));

vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));

import { AdminSidebar } from "./AdminSidebar";

beforeEach(() => {
  mocks.pathname = "/admin";
});

describe("AdminSidebar Portfolio navigation", () => {
  it("opens the public portfolio in a new tab, preserving the admin session in the current tab", () => {
    const html = renderToStaticMarkup(
      <AdminSidebar adminEmail="admin@example.test" onLogout={async () => {}} />
    );

    expect(html).toContain('href="/work"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("does not send admin-only routes to a new tab", () => {
    const html = renderToStaticMarkup(
      <AdminSidebar adminEmail="admin@example.test" onLogout={async () => {}} />
    );

    expect(html).toContain('href="/admin"');
    expect(html).toContain('href="/admin/clients"');
    expect(html).toContain('href="/admin/galleries"');
    expect(html.match(/target="_blank"/g)).toHaveLength(1);
  });

  it("marks the real current admin section instead of always marking the dashboard", () => {
    mocks.pathname = "/admin/galleries/gallery-1";

    const html = renderToStaticMarkup(
      <AdminSidebar adminEmail="admin@example.test" onLogout={async () => {}} />
    );

    expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/admin\/galleries"/);
    expect(html).not.toMatch(/<a[^>]*aria-current="page"[^>]*href="\/admin"/);
  });

  it("exposes mobile navigation controls", () => {
    const html = renderToStaticMarkup(
      <AdminSidebar adminEmail="admin@example.test" onLogout={async () => {}} />
    );

    expect(html).toContain('aria-controls="admin-navigation"');
    expect(html).toContain('aria-expanded="false"');
  });
});
