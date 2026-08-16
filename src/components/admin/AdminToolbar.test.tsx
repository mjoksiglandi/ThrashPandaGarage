import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminToolbar } from "./AdminToolbar";

describe("AdminToolbar", () => {
  it("submits the active filter together with the replacement search query", () => {
    const html = renderToStaticMarkup(
      <AdminToolbar
        placeholder="Buscar…"
        preservedParams={{ status: "ACTIVE" }}
        query="juan"
        resetHref="/admin/galleries"
      />
    );

    expect(html).toContain('name="status"');
    expect(html).toContain('type="hidden"');
    expect(html).toContain('value="ACTIVE"');
    expect(html).toContain('name="q"');
    expect(html).toContain('value="juan"');
  });
});
