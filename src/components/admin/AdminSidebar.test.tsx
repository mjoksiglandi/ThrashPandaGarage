import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminSidebar } from "./AdminSidebar";

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
});
